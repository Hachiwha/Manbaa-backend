import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CanvasRealtimeService } from './canvas-realtime.service';
import { CanvasAiSuggestion, AiSuggestionStatus } from '../entities/canvas-ai-suggestion.entity';

export interface CreateSuggestionInput {
  taskId: string;
  organizationId: string;
  workspaceId: string;
  canvasId: string;
  snapshotId: string | null;
  snapshotVersion: number | null;
  canvasRevision: number | null;
  resultType: string;
  componentSpec: Record<string, unknown> | null;
  assetId: string | null;
  assetVersionId: string | null;
  enhancedPrompt: string | null;
  evidenceIds: string[] | null;
}

@Injectable()
export class CanvasAiSuggestionService {
  constructor(
    @InjectRepository(CanvasAiSuggestion)
    private readonly suggestions: Repository<CanvasAiSuggestion>,
    private readonly realtime: CanvasRealtimeService,
  ) {}

  async findById(id: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion> {
    const suggestion = await this.suggestions.findOne({
      where: { id, organizationId, workspaceId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    return suggestion;
  }

  async findByTaskId(taskId: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion | null> {
    return this.suggestions.findOne({
      where: { taskId, organizationId, workspaceId },
    });
  }

  async findByCanvas(canvasId: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion[]> {
    return this.suggestions.find({
      where: { canvasId, organizationId, workspaceId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async createOrUpdate(input: CreateSuggestionInput): Promise<CanvasAiSuggestion> {
    const existing = await this.suggestions.findOne({
      where: { taskId: input.taskId, organizationId: input.organizationId, workspaceId: input.workspaceId },
    });
    if (existing) {
      existing.status = AiSuggestionStatus.READY;
      existing.componentSpec = input.componentSpec;
      existing.assetId = input.assetId;
      existing.assetVersionId = input.assetVersionId;
      existing.enhancedPrompt = input.enhancedPrompt;
      existing.evidenceIds = input.evidenceIds;
      existing.resultType = input.resultType;
      existing.snapshotId = input.snapshotId ?? existing.snapshotId;
      existing.snapshotVersion = input.snapshotVersion ?? existing.snapshotVersion;
      existing.canvasRevision = input.canvasRevision ?? existing.canvasRevision;
      await this.suggestions.save(existing);
      return existing;
    }
    const suggestion = this.suggestions.create({
      taskId: input.taskId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      canvasId: input.canvasId,
      snapshotId: input.snapshotId,
      snapshotVersion: input.snapshotVersion,
      canvasRevision: input.canvasRevision,
      resultType: input.resultType,
      componentSpec: input.componentSpec,
      assetId: input.assetId,
      assetVersionId: input.assetVersionId,
      enhancedPrompt: input.enhancedPrompt,
      evidenceIds: input.evidenceIds,
      status: AiSuggestionStatus.READY,
    });
    const saved = await this.suggestions.save(suggestion);
    this.realtime.broadcastAiPreviewReady({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      canvas_id: input.canvasId,
      task_id: input.taskId,
      suggestion_id: saved.id,
      snapshot_id: input.snapshotId ?? '',
      snapshot_version: input.snapshotVersion ?? 0,
      canvas_revision: input.canvasRevision ?? 0,
      result_type: input.resultType,
    });
    return saved;
  }

  async accept(id: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion> {
    const suggestion = await this.findById(id, organizationId, workspaceId);
    if (suggestion.stale) {
      throw new ConflictException('Cannot accept a stale suggestion');
    }
    if (suggestion.status === AiSuggestionStatus.ACCEPTED) {
      throw new ConflictException('Suggestion is already accepted');
    }
    if (suggestion.status !== AiSuggestionStatus.READY) {
      throw new BadRequestException(`Cannot accept suggestion in status ${suggestion.status}`);
    }
    suggestion.status = AiSuggestionStatus.ACCEPTED;
    suggestion.acceptedAt = new Date();
    const saved = await this.suggestions.save(suggestion);
    this.realtime.broadcastAiPreviewAccepted({
      organization_id: organizationId,
      workspace_id: workspaceId,
      canvas_id: suggestion.canvasId,
      task_id: suggestion.taskId,
      suggestion_id: saved.id,
      snapshot_id: suggestion.snapshotId ?? '',
      snapshot_version: suggestion.snapshotVersion ?? 0,
      canvas_revision: suggestion.canvasRevision ?? 0,
      accepted_at: saved.acceptedAt.toISOString(),
    });
    return saved;
  }

  async reject(id: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion> {
    const suggestion = await this.findById(id, organizationId, workspaceId);
    if (suggestion.stale) {
      throw new ConflictException('Cannot reject a stale suggestion');
    }
    if (suggestion.status === AiSuggestionStatus.REJECTED) {
      throw new ConflictException('Suggestion is already rejected');
    }
    if (suggestion.status !== AiSuggestionStatus.READY) {
      throw new BadRequestException(`Cannot reject suggestion in status ${suggestion.status}`);
    }
    suggestion.status = AiSuggestionStatus.REJECTED;
    suggestion.rejectedAt = new Date();
    const saved = await this.suggestions.save(suggestion);
    this.realtime.broadcastAiPreviewRejected({
      organization_id: organizationId,
      workspace_id: workspaceId,
      canvas_id: suggestion.canvasId,
      task_id: suggestion.taskId,
      suggestion_id: saved.id,
      snapshot_id: suggestion.snapshotId ?? '',
      snapshot_version: suggestion.snapshotVersion ?? 0,
      canvas_revision: suggestion.canvasRevision ?? 0,
      rejected_at: saved.rejectedAt.toISOString(),
    });
    return saved;
  }

  async markStale(canvasId: string, currentSnapshotId: string, currentSnapshotVersion: number, organizationId: string, workspaceId: string): Promise<number> {
    const updated = await this.suggestions.update(
      {
        canvasId,
        organizationId,
        workspaceId,
        stale: false,
        status: In([AiSuggestionStatus.QUEUED, AiSuggestionStatus.PROCESSING, AiSuggestionStatus.READY]),
      },
      { stale: true, status: AiSuggestionStatus.STALE },
    );
    if ((updated.affected ?? 0) > 0) {
      this.realtime.broadcastAiPreviewStale({
        organization_id: organizationId,
        workspace_id: workspaceId,
        canvas_id: canvasId,
        task_id: '',
        snapshot_id: currentSnapshotId,
        canvas_revision: currentSnapshotVersion,
      });
    }
    return updated.affected ?? 0;
  }
}