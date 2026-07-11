import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CanvasAiSuggestion, AiSuggestionStatus } from '../entities/canvas-ai-suggestion.entity';

@Injectable()
export class CanvasAiSuggestionService {
  constructor(
    @InjectRepository(CanvasAiSuggestion)
    private readonly suggestions: Repository<CanvasAiSuggestion>,
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

  async accept(id: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion> {
    const suggestion = await this.findById(id, organizationId, workspaceId);
    suggestion.status = AiSuggestionStatus.ACCEPTED;
    suggestion.acceptedAt = new Date();
    return this.suggestions.save(suggestion);
  }

  async reject(id: string, organizationId: string, workspaceId: string): Promise<CanvasAiSuggestion> {
    const suggestion = await this.findById(id, organizationId, workspaceId);
    suggestion.status = AiSuggestionStatus.REJECTED;
    suggestion.rejectedAt = new Date();
    return this.suggestions.save(suggestion);
  }

  async markStale(canvasId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.suggestions.update(
      { canvasId, organizationId, workspaceId, stale: false },
      { stale: true, status: AiSuggestionStatus.STALE },
    );
  }
}
