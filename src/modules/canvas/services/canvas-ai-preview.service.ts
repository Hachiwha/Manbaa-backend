import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { validate as validateUuid, v5 as uuidv5 } from 'uuid';

import { RequestContextService } from '../../../core/context/request-context.service';
import { createCanvasAiPreviewRequestedEvent } from '../../../core/messaging/events';
import {
  StoredWorkspaceSnapshot,
  WorkspaceStorageService,
} from '../../../infra/storage/workspace-storage.service';
import { AiTask, JobStatus } from '../../jobs/entities/ai-task.entity';
import { OutboxService } from '../../outbox/outbox.service';
import { Source } from '../../sources/entities';
import { UsageDimension } from '../../usage/entities/usage.entity';
import { UsageService } from '../../usage/usage.service';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { WorkspacePermissionService } from '../../workspaces/workspace-permission.service';
import {
  CanvasAiPreviewOperation,
  CanvasAiPreviewRequestDto,
  CanvasAiPreviewResponseDto,
} from '../dto/canvas-ai-preview.dto';
import {
  AiPreviewArtifactStatus,
  AiPreviewSnapshot,
  AiPreviewSnapshotStatus,
} from '../entities/ai-preview-snapshot.entity';
import { Canvas } from '../entities/canvas.entity';
import { CanvasAiPreviewCoordinator } from './canvas-ai-preview-coordinator.service';
import { CanvasRealtimeService } from './canvas-realtime.service';
import { CanvasSnapshotSerializer } from './canvas-snapshot-serializer.service';

type RequestUser = { id: string; orgId: string; role: string };

interface NormalizedPreviewTarget {
  operation: CanvasAiPreviewOperation;
  selectedElementIds: string[];
  lockedElementIds: string[];
  editableElementIds: string[];
  sourceIds: string[];
  userPrompt: string;
  desiredWidth: number;
  desiredHeight: number;
  autoApply: false;
}

interface SupersededLineage {
  taskId: string;
  snapshotId: string;
}

interface PersistedPreview {
  task: AiTask;
  snapshot: AiPreviewSnapshot;
  createdSnapshot: boolean;
  duplicate: boolean;
  superseded: SupersededLineage[];
}

const PREVIEW_ID_NAMESPACE = '80f415c0-476b-4ed4-a805-09f317ed89db';
const MAX_IDEMPOTENCY_KEY_LENGTH = 160;
const ACTIVE_PREVIEW_STATUSES = [
  JobStatus.QUEUED,
  JobStatus.RUNNING,
  JobStatus.WAITING_FOR_USER,
];

@Injectable()
export class CanvasAiPreviewService {
  private readonly logger = new Logger(CanvasAiPreviewService.name);

  constructor(
    @InjectRepository(AiTask)
    private readonly tasks: Repository<AiTask>,
    private readonly dataSource: import('typeorm').DataSource,
    private readonly permissions: WorkspacePermissionService,
    private readonly storage: WorkspaceStorageService,
    private readonly serializer: CanvasSnapshotSerializer,
    private readonly outbox: OutboxService,
    private readonly usage: UsageService,
    private readonly context: RequestContextService,
    private readonly realtime: CanvasRealtimeService,
    private readonly coordinator: CanvasAiPreviewCoordinator,
  ) {}

  async createExplicit(
    workspaceId: string,
    canvasId: string,
    dto: CanvasAiPreviewRequestDto,
    idempotencyKey: string | undefined,
    user: RequestUser,
  ): Promise<CanvasAiPreviewResponseDto> {
    this.coordinator.cancel(canvasId);
    return this.create(workspaceId, canvasId, dto, idempotencyKey, user);
  }

  scheduleAutomatic(
    workspaceId: string,
    canvas: Canvas,
    user: RequestUser,
  ): { scheduled: boolean; dueAt?: number } {
    if (!canvas.workspaceId || canvas.workspaceId !== workspaceId) {
      return { scheduled: false };
    }
    const revision = Number(canvas.revision);
    return this.coordinator.scheduleEdit(canvas.id, revision, async () => {
      await this.create(
        workspaceId,
        canvas.id,
        {
          operation: CanvasAiPreviewOperation.IMPROVE_CANVAS,
          user_prompt: 'Improve this canvas while preserving its intent.',
          selected_element_ids: [],
          locked_element_ids: [],
          editable_element_ids: [],
          source_ids: [],
          desired_width: canvas.width,
          desired_height: canvas.height,
          auto_apply: false,
        },
        `auto:${canvas.id}:${revision}`,
        user,
      );
    });
  }

  private async create(
    workspaceId: string,
    canvasId: string,
    dto: CanvasAiPreviewRequestDto,
    rawIdempotencyKey: string | undefined,
    user: RequestUser,
  ): Promise<CanvasAiPreviewResponseDto> {
    const idempotencyKey = this.normalizeIdempotencyKey(
      workspaceId,
      canvasId,
      user.id,
      rawIdempotencyKey,
    );
    const correlationId = this.context.getCorrelationId();
    if (!validateUuid(correlationId)) {
      throw new BadRequestException('Correlation ID must be a UUID');
    }
    if (dto.auto_apply !== false) {
      throw new BadRequestException('auto_apply must be false');
    }
    const target = this.normalizeTarget(dto);
    this.assertLockedEditableDisjoint(target);

    await this.permissions.requireEditor(user.id, workspaceId, user.orgId);

    const preexisting = await this.tasks.findOne({
      where: {
        idempotencyKey,
        organizationId: user.orgId,
        workspaceId,
        canvasId,
      },
    });
    if (preexisting) return this.responseFromTask(preexisting);

    const stableSeed = `${idempotencyKey}:${user.orgId}:${workspaceId}:${canvasId}`;
    const taskId = uuidv5(`task:${stableSeed}`, PREVIEW_ID_NAMESPACE);
    const snapshotId = uuidv5(`snapshot:${stableSeed}`, PREVIEW_ID_NAMESPACE);
    const eventId = uuidv5(`event:${stableSeed}`, PREVIEW_ID_NAMESPACE);
    const storageContext = {
      organizationId: user.orgId,
      workspaceId,
    };
    let stored: StoredWorkspaceSnapshot | undefined;

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const canvas = await manager.findOne(Canvas, {
          where: { id: canvasId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!canvas) throw new NotFoundException('Canvas not found');

        const workflow = await manager.findOne(Workflow, {
          where: { id: canvas.workflowId, orgId: user.orgId },
        });
        if (!workflow) throw new NotFoundException('Canvas not found');

        if (canvas.workspaceId && canvas.workspaceId !== workspaceId) {
          throw new ForbiddenException('Canvas belongs to another workspace');
        }
        if (!canvas.workspaceId) {
          canvas.workspaceId = workspaceId;
          await manager.save(canvas);
        }

        const duplicate = await manager.findOne(AiTask, {
          where: {
            idempotencyKey,
            organizationId: user.orgId,
            workspaceId,
            canvasId,
          },
        });
        if (duplicate) {
          const snapshot = await this.requireTaskSnapshot(manager, duplicate);
          return {
            task: duplicate,
            snapshot,
            createdSnapshot: false,
            duplicate: true,
            superseded: [],
          } satisfies PersistedPreview;
        }

        const canvasRevision = Number(canvas.revision);
        if (!Number.isSafeInteger(canvasRevision) || canvasRevision < 0) {
          throw new BadRequestException('Canvas revision is invalid');
        }

        await this.assertSourcesInTenant(
          manager,
          target.sourceIds,
          user.orgId,
          workspaceId,
        );
        const activeAtRevision = await manager.find(AiTask, {
          where: {
            organizationId: user.orgId,
            workspaceId,
            canvasId,
            canvasRevision,
            status: In(ACTIVE_PREVIEW_STATUSES),
          },
        });
        const equivalent = activeAtRevision.find((candidate) =>
          this.sameTarget(candidate.requestPayload, target),
        );
        if (equivalent) {
          const snapshot = await this.requireTaskSnapshot(manager, equivalent);
          return {
            task: equivalent,
            snapshot,
            createdSnapshot: false,
            duplicate: true,
            superseded: [],
          } satisfies PersistedPreview;
        }

        let snapshot = await manager.findOne(AiPreviewSnapshot, {
          where: {
            organizationId: user.orgId,
            workspaceId,
            canvasId,
            canvasRevision,
            status: AiPreviewSnapshotStatus.AVAILABLE,
          },
          order: { snapshotVersion: 'DESC' },
        });
        let createdSnapshot = false;
        if (!snapshot) {
          const latest = await manager.findOne(AiPreviewSnapshot, {
            where: { canvasId },
            order: { snapshotVersion: 'DESC' },
          });
          const snapshotVersion = (latest?.snapshotVersion ?? 0) + 1;
          const serialized = await this.serializer.serialize(
            canvasId,
            canvasRevision,
            manager,
          );
          this.assertElementReferences(serialized.document.elements, target);
          stored = await this.storage.storeSnapshot(
            storageContext,
            canvasId,
            snapshotId,
            snapshotVersion,
            serialized.jsonBytes,
          );
          if (
            stored.bucket !== 'workspace-snapshots' ||
            stored.checksumSha256 !== serialized.checksumSha256 ||
            stored.sizeBytes !== serialized.sizeBytes ||
            stored.contentType !== 'application/json'
          ) {
            throw new InternalServerErrorException(
              'Stored snapshot metadata does not match the frozen bytes',
            );
          }
          snapshot = manager.create(AiPreviewSnapshot, {
            id: snapshotId,
            organizationId: user.orgId,
            workspaceId,
            projectId: workflow.projectId ?? null,
            canvasId,
            snapshotVersion,
            canvasRevision,
            status: AiPreviewSnapshotStatus.AVAILABLE,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            checksumSha256: stored.checksumSha256,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            previewStatus: AiPreviewArtifactStatus.PENDING,
            previewBucket: null,
            previewKey: null,
            previewChecksumSha256: null,
            createdBy: user.id,
            supersededBySnapshotId: null,
          });
          snapshot = await manager.save(snapshot);
          createdSnapshot = true;
        } else {
          const serialized = await this.serializer.serialize(
            canvasId,
            canvasRevision,
            manager,
          );
          this.assertElementReferences(serialized.document.elements, target);
        }

        const reservation = await this.usage.reserveUsage(
          {
            organizationId: user.orgId,
            workspaceId,
            dimension: UsageDimension.AI_INPUT_TOKENS,
            amount: 1,
            idempotencyKey: `canvas-preview:${taskId}`,
          },
          manager,
        );
        let task = manager.create(AiTask, {
          id: taskId,
          organizationId: user.orgId,
          workspaceId,
          userId: user.id,
          taskType: 'canvas.ai.preview.validate',
          status: JobStatus.QUEUED,
          progress: 0,
          currentStep: 'snapshot_queued',
          requestPayload: target as unknown as Record<string, unknown>,
          resultPayload: null,
          errorCode: null,
          errorMessage: null,
          correlationId,
          idempotencyKey,
          usageReservationId: reservation.id,
          canvasId,
          snapshotId: snapshot.id,
          snapshotVersion: snapshot.snapshotVersion,
          canvasRevision,
          supersededByTaskId: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        });
        task = await manager.save(task);

        const olderActive = (
          await manager.find(AiTask, {
            where: {
              organizationId: user.orgId,
              workspaceId,
              canvasId,
              status: In(ACTIVE_PREVIEW_STATUSES),
            },
          })
        ).filter(
          (candidate) =>
            candidate.id !== task.id &&
            candidate.canvasRevision !== null &&
            Number(candidate.canvasRevision) < canvasRevision,
        );
        const superseded: SupersededLineage[] = [];
        const supersededSnapshotIds = new Set<string>();
        for (const older of olderActive) {
          older.status = JobStatus.SUPERSEDED;
          older.supersededByTaskId = task.id;
          await manager.save(older);
          await this.usage.releaseUsage(older.usageReservationId, manager);
          if (older.snapshotId) {
            superseded.push({ taskId: older.id, snapshotId: older.snapshotId });
            supersededSnapshotIds.add(older.snapshotId);
          }
        }
        for (const supersededSnapshotId of supersededSnapshotIds) {
          const olderSnapshot = await manager.findOne(AiPreviewSnapshot, {
            where: {
              id: supersededSnapshotId,
              organizationId: user.orgId,
              workspaceId,
              canvasId,
            },
          });
          if (olderSnapshot) {
            olderSnapshot.status = AiPreviewSnapshotStatus.SUPERSEDED;
            olderSnapshot.supersededBySnapshotId = snapshot.id;
            await manager.save(olderSnapshot);
          }
        }

        const event = createCanvasAiPreviewRequestedEvent({
          eventId,
          organizationId: user.orgId,
          workspaceId,
          projectId: workflow.projectId ?? null,
          correlationId,
          causationId: null,
          actor: { type: 'user', id: user.id },
          payload: {
            taskId: task.id,
            canvasId,
            canvasRevision,
            snapshotId: snapshot.id,
            snapshotVersion: snapshot.snapshotVersion,
            storageBucket: 'workspace-snapshots',
            storageKey: snapshot.storageKey,
            checksumSha256: snapshot.checksumSha256,
            previewStatus: 'pending',
            previewBucket: null,
            previewKey: null,
            previewChecksumSha256: null,
            operation: target.operation,
            selectedElementIds: target.selectedElementIds,
            lockedElementIds: target.lockedElementIds,
            editableElementIds: target.editableElementIds,
            sourceIds: target.sourceIds,
            userPrompt: target.userPrompt,
            desiredWidth: target.desiredWidth,
            desiredHeight: target.desiredHeight,
          },
        });
        await this.outbox.create(
          manager,
          {
            aggregateType: 'ai_preview_snapshot',
            aggregateId: snapshot.id,
            eventType: event.event_type,
            payload: event as unknown as Record<string, unknown>,
            correlationId,
          },
          { eventId, eventIdField: 'event_id' },
        );

        return {
          task,
          snapshot,
          createdSnapshot,
          duplicate: false,
          superseded,
        } satisfies PersistedPreview;
      });

      if (!result.duplicate) this.emitPersistedEvents(result, user.orgId, workspaceId, canvasId);
      return this.responseFromTask(result.task);
    } catch (error) {
      if (stored) {
        try {
          await this.storage.deleteObject(
            storageContext,
            stored.bucket,
            stored.key,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to delete rolled-back canvas snapshot ${stored.key}: ${(cleanupError as Error).message}`,
          );
        }
      }
      throw error;
    }
  }

  private normalizeTarget(
    dto: CanvasAiPreviewRequestDto,
  ): NormalizedPreviewTarget {
    return {
      operation: dto.operation,
      selectedElementIds: [...dto.selected_element_ids].sort(),
      lockedElementIds: [...dto.locked_element_ids].sort(),
      editableElementIds: [...dto.editable_element_ids].sort(),
      sourceIds: [...dto.source_ids].sort(),
      userPrompt: dto.user_prompt,
      desiredWidth: dto.desired_width,
      desiredHeight: dto.desired_height,
      autoApply: false,
    };
  }

  private normalizeIdempotencyKey(
    workspaceId: string,
    canvasId: string,
    userId: string,
    raw: string | undefined,
  ): string {
    if (
      !raw ||
      raw.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
      !/^[\x21-\x7e]+$/.test(raw)
    ) {
      throw new BadRequestException(
        `Idempotency-Key must contain 1-${MAX_IDEMPOTENCY_KEY_LENGTH} printable non-space ASCII characters`,
      );
    }
    const digest = createHash('sha256')
      .update(`${workspaceId}:${canvasId}:${userId}:${raw}`)
      .digest('hex');
    return `canvas-preview:${digest}`;
  }

  private assertLockedEditableDisjoint(target: NormalizedPreviewTarget): void {
    const locked = new Set(target.lockedElementIds);
    if (target.editableElementIds.some((id) => locked.has(id))) {
      throw new BadRequestException(
        'locked_element_ids and editable_element_ids must not overlap',
      );
    }
  }

  private assertElementReferences(
    elements: Array<{ id: string }>,
    target: NormalizedPreviewTarget,
  ): void {
    const known = new Set(elements.map((element) => element.id));
    const requested = [
      ...target.selectedElementIds,
      ...target.lockedElementIds,
      ...target.editableElementIds,
    ];
    const unknown = requested.filter((id) => !known.has(id));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown canvas element ID: ${[...new Set(unknown)].sort()[0]}`,
      );
    }
  }

  private async assertSourcesInTenant(
    manager: import('typeorm').EntityManager,
    sourceIds: string[],
    organizationId: string,
    workspaceId: string,
  ): Promise<void> {
    if (!sourceIds.length) return;
    const count = await manager.count(Source, {
      where: {
        id: In(sourceIds),
        organizationId,
        workspaceId,
      },
    });
    if (count !== sourceIds.length) {
      throw new BadRequestException(
        'Every source_id must belong to the requested workspace',
      );
    }
  }

  private sameTarget(
    payload: Record<string, unknown>,
    target: NormalizedPreviewTarget,
  ): boolean {
    return JSON.stringify(payload) === JSON.stringify(target);
  }

  private async requireTaskSnapshot(
    manager: import('typeorm').EntityManager,
    task: AiTask,
  ): Promise<AiPreviewSnapshot> {
    if (!task.snapshotId) {
      throw new InternalServerErrorException(
        'Canvas preview task is missing snapshot lineage',
      );
    }
    const snapshot = await manager.findOne(AiPreviewSnapshot, {
      where: {
        id: task.snapshotId,
        organizationId: task.organizationId,
        workspaceId: task.workspaceId,
      },
    });
    if (!snapshot) {
      throw new InternalServerErrorException(
        'Canvas preview snapshot lineage is missing',
      );
    }
    return snapshot;
  }

  private responseFromTask(task: AiTask): CanvasAiPreviewResponseDto {
    if (
      !task.snapshotId ||
      task.snapshotVersion === null ||
      task.canvasRevision === null
    ) {
      throw new InternalServerErrorException(
        'Canvas preview task is missing snapshot lineage',
      );
    }
    return {
      taskId: task.id,
      snapshotId: task.snapshotId,
      snapshotVersion: task.snapshotVersion,
      canvasRevision: Number(task.canvasRevision),
      status: task.status,
    };
  }

  private emitPersistedEvents(
    result: PersistedPreview,
    organizationId: string,
    workspaceId: string,
    canvasId: string,
  ): void {
    const scope = {
      organization_id: organizationId,
      workspace_id: workspaceId,
      canvas_id: canvasId,
    };
    if (result.createdSnapshot) {
      this.realtime.broadcastSnapshotCreated({
        ...scope,
        task_id: result.task.id,
        snapshot_id: result.snapshot.id,
        snapshot_version: result.snapshot.snapshotVersion,
        canvas_revision: Number(result.snapshot.canvasRevision),
        status: result.snapshot.status,
        created_at:
          result.snapshot.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }
    this.realtime.broadcastAiPreviewQueued({
      ...scope,
      task_id: result.task.id,
      snapshot_id: result.snapshot.id,
      snapshot_version: result.snapshot.snapshotVersion,
      canvas_revision: Number(result.snapshot.canvasRevision),
      status: result.task.status,
    });
    for (const superseded of result.superseded) {
      this.realtime.broadcastAiPreviewSuperseded({
        ...scope,
        superseded_task_id: superseded.taskId,
        superseded_snapshot_id: superseded.snapshotId,
        replacement_task_id: result.task.id,
        replacement_snapshot_id: result.snapshot.id,
        canvas_revision: Number(result.snapshot.canvasRevision),
      });
    }
  }
}
