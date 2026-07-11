import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InternalServiceTokenService } from '../../core/internal-auth/internal-service-token.service';
import { assertDomainEvent, DomainEvent } from '../../core/messaging/domain-event';
import { NatsClientService } from '../../infra/nats/nats.client';
import { CanvasAiPreviewStartedPayload, CanvasAiPreviewProgressPayload, CanvasAiPreviewFailedPayload, CanvasAiPreviewCancelledPayload, CanvasAiPreviewStalePayload } from '../realtime/interfaces/ws-payloads.interface';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { CanvasRealtimeService } from '../canvas/services/canvas-realtime.service';
import { CanvasAiSuggestionService } from '../canvas/services/canvas-ai-suggestion.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsageService } from '../usage/usage.service';
import { AiTask, JobStatus } from './entities/ai-task.entity';

type TaskEventPayload = Record<string, unknown> & {
  taskId: string; internalToken: string; progress?: number; currentStep?: string;
  snapshotId?: string; snapshotVersion?: number; canvasRevision?: number;
  result?: Record<string, unknown>; errorCode?: string; errorMessage?: string; actualUsage?: number;
};

@Injectable()
export class AiTaskEventsService implements OnModuleInit {
  constructor(
    @InjectRepository(AiTask) private readonly tasks: Repository<AiTask>,
    private readonly db: DataSource,
    private readonly nats: NatsClientService,
    private readonly usage: UsageService,
    private readonly notifications: NotificationsService,
    private readonly audit: PlatformAuditService,
    private readonly realtime: RealtimeGateway,
    private readonly internalTokens: InternalServiceTokenService,
    private readonly suggestions: CanvasAiSuggestionService,
    private readonly canvasRealtime: CanvasRealtimeService,
  ) {}

  async onModuleInit() {
    for (const type of ['started', 'progress', 'completed', 'failed', 'cancelled']) {
      await this.nats.subscribeDurable({ subject: `workspace.ai.task.${type}`, durableName: `nestjs-workspace-ai-${type}`, handler: event => this.handle(type, event) });
    }
  }

  async handle(kind: string, value: Record<string, unknown>) {
    assertDomainEvent(value);
    const event = value as unknown as DomainEvent<TaskEventPayload>;
    if (event.eventType !== `workspace.ai.task.${kind}`) throw new Error('Worker event type mismatch');
    const claims = await this.internalTokens.validate(event.payload.internalToken, 'nestjs-platform');
    if (claims.organizationId !== event.organizationId || claims.workspaceId !== event.workspaceId || claims.taskId !== event.payload.taskId || !claims.allowedActions.includes(`ai.task.${kind}`)) {
      throw new Error('Worker event authorization mismatch');
    }
    const task = await this.tasks.findOne({ where: { id: event.payload.taskId, organizationId: event.organizationId, workspaceId: event.workspaceId } });
    if (!task) throw new Error('AI task scope mismatch');
    let broadcastEvent = `ai.task.${kind}`;
    let broadcastPayload: Record<string, unknown> = event.payload;
    if (kind === 'started') {
      if (task.status !== JobStatus.QUEUED) return;
      task.status = JobStatus.RUNNING; task.startedAt = new Date(); task.currentStep = event.payload.currentStep ?? null; await this.tasks.save(task);
      if (task.canvasId) {
        this.canvasRealtime.broadcastAiPreviewStarted({
          organization_id: task.organizationId,
          workspace_id: task.workspaceId,
          canvas_id: task.canvasId,
          task_id: task.id,
          snapshot_id: task.snapshotId ?? '',
          snapshot_version: task.snapshotVersion ?? 0,
          canvas_revision: Number(task.canvasRevision ?? 0),
          current_step: event.payload.currentStep ?? 'started',
        });
      }
    } else if (kind === 'progress') {
      if (![JobStatus.RUNNING, JobStatus.WAITING_FOR_USER].includes(task.status)) return;
      task.progress = Math.max(task.progress, Math.min(99, event.payload.progress ?? task.progress)); task.currentStep = event.payload.currentStep ?? task.currentStep; await this.tasks.save(task);
      if (task.canvasId) {
        this.canvasRealtime.broadcastAiPreviewProgress({
          organization_id: task.organizationId,
          workspace_id: task.workspaceId,
          canvas_id: task.canvasId,
          task_id: task.id,
          snapshot_id: task.snapshotId ?? '',
          snapshot_version: task.snapshotVersion ?? 0,
          canvas_revision: Number(task.canvasRevision ?? 0),
          progress: task.progress,
          current_step: task.currentStep ?? '',
        });
      }
    } else if (kind === 'cancelled') {
      if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.STALE].includes(task.status)) return;
      await this.db.transaction(async manager => {
        task.status = JobStatus.CANCELLED; task.cancelledAt = new Date(); await manager.save(task);
        await this.usage.releaseUsage(task.usageReservationId, manager);
      });
      if (task.canvasId) {
        this.canvasRealtime.broadcastAiPreviewCancelled({
          organization_id: task.organizationId,
          workspace_id: task.workspaceId,
          canvas_id: task.canvasId,
          task_id: task.id,
          snapshot_id: task.snapshotId ?? undefined,
        });
      }
    } else {
      const outcome = await this.finish(task, event, kind === 'completed');
      if (outcome === 'ignored') return;
      if (outcome === 'stale') {
        broadcastEvent = 'ai.task.stale';
        broadcastPayload = {
          taskId: task.id,
          snapshotId: task.snapshotId,
          canvasRevision: task.canvasRevision,
          currentStep: 'stale_result_ignored',
        };
      }
      if (kind === 'completed' && outcome === 'finished' && task.canvasId) {
        await this.createSuggestionFromResult(task, event);
      }
      if (kind === 'failed' && outcome === 'finished' && task.canvasId) {
        this.canvasRealtime.broadcastAiPreviewFailed({
          organization_id: task.organizationId,
          workspace_id: task.workspaceId,
          canvas_id: task.canvasId,
          task_id: task.id,
          snapshot_id: task.snapshotId ?? undefined,
          error_code: event.payload.errorCode ?? 'WORKER_FAILED',
          error_message: event.payload.errorMessage ?? 'Worker task failed',
        });
      }
    }
    this.broadcast(task, broadcastEvent, broadcastPayload);
  }

  private async createSuggestionFromResult(task: AiTask, event: DomainEvent<TaskEventPayload>): Promise<void> {
    const result = event.payload.result ?? {};
    const componentSpec = result.componentSpec as Record<string, unknown> | undefined;
    const assetId = result.assetId as string | undefined;
    const assetVersionId = result.assetVersionId as string | undefined;
    const enhancedPrompt = result.enhancedPrompt as string | undefined;
    const evidenceIds = result.evidenceIds as string[] | undefined;

    const resultType = componentSpec ? 'component' : assetId ? 'image' : 'unknown';

    await this.suggestions.createOrUpdate({
      taskId: task.id,
      organizationId: task.organizationId,
      workspaceId: task.workspaceId,
      canvasId: task.canvasId ?? '',
      snapshotId: task.snapshotId,
      snapshotVersion: task.snapshotVersion,
      canvasRevision: task.canvasRevision ? Number(task.canvasRevision) : null,
      resultType,
      componentSpec: componentSpec ?? null,
      assetId: assetId ?? null,
      assetVersionId: assetVersionId ?? null,
      enhancedPrompt: enhancedPrompt ?? null,
      evidenceIds: evidenceIds ?? null,
    });
  }

  private async finish(
    task: AiTask,
    event: DomainEvent<TaskEventPayload>,
    success: boolean,
  ): Promise<'finished' | 'ignored' | 'stale'> {
    if (task.status === JobStatus.SUPERSEDED) {
      task.status = JobStatus.STALE;
      task.resultPayload = null;
      task.errorCode = 'STALE_RESULT';
      task.errorMessage = 'A late worker result was ignored after supersession';
      task.completedAt = new Date();
      await this.tasks.save(task);
      await this.audit.createAuditLog({
        organizationId: task.organizationId,
        workspaceId: task.workspaceId,
        actorId: task.userId,
        action: 'ai_task.stale',
        entityType: 'ai_task',
        entityId: task.id,
        after: { status: task.status },
        correlationId: event.correlationId,
      });
      if (task.canvasId) {
        this.canvasRealtime.broadcastAiPreviewStale({
          organization_id: task.organizationId,
          workspace_id: task.workspaceId,
          canvas_id: task.canvasId,
          task_id: task.id,
          snapshot_id: task.snapshotId ?? '',
          canvas_revision: Number(task.canvasRevision ?? 0),
        });
      }
      return 'stale';
    }
    if (
      [
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
        JobStatus.STALE,
      ].includes(task.status)
    )
      return 'ignored';
    await this.db.transaction(async manager => {
      task.status = success ? JobStatus.COMPLETED : JobStatus.FAILED; task.progress = success ? 100 : task.progress;
      task.resultPayload = success ? event.payload.result ?? {} : null;
      task.errorCode = success ? null : (event.payload.errorCode ?? 'WORKER_FAILED').slice(0, 100);
      task.errorMessage = success ? null : (event.payload.errorMessage ?? 'Worker task failed').slice(0, 1000);
      task.completedAt = new Date(); await manager.save(task);
      if (success) await this.usage.commitUsage(task.usageReservationId, event.payload.actualUsage ?? 1, manager);
      else await this.usage.releaseUsage(task.usageReservationId, manager);
    });
    await this.notifications.createNotification({ organizationId: task.organizationId, workspaceId: task.workspaceId, userId: task.userId, type: success ? NotificationType.AI_TASK_COMPLETED : NotificationType.AI_TASK_FAILED, title: success ? 'AI task completed' : 'AI task failed', body: success ? 'Your AI task is ready.' : 'Your AI task could not be completed.', metadata: { taskId: task.id } });
    await this.audit.createAuditLog({ organizationId: task.organizationId, workspaceId: task.workspaceId, actorId: task.userId, action: success ? 'ai_task.completed' : 'ai_task.failed', entityType: 'ai_task', entityId: task.id, after: { status: task.status }, correlationId: event.correlationId });
    return 'finished';
  }

  private broadcast(task: AiTask, event: string, payload: Record<string, unknown>) {
    const { internalToken: _internalToken, ...safePayload } = payload;
    const data = { taskId: task.id, correlationId: task.correlationId, ...safePayload };
    this.realtime.emitToRoom(`ai-task:${task.id}`, event, data); this.realtime.emitToRoom(`workspace:${task.workspaceId}`, event, data); this.realtime.emitToUser(task.userId, event, data);
  }
}