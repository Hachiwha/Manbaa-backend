import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { CanvasAiSuggestion } from '../entities/canvas-ai-suggestion.entity';
import { CanvasAiSuggestionService } from '../services/canvas-ai-suggestion.service';

type RequestUser = { id: string; orgId: string; role: string };

@ApiTags('canvas')
@ApiBearerAuth()
@Controller('v1/workspaces/:workspaceId/canvases/:canvasId/suggestions')
export class CanvasAiSuggestionController {
  constructor(private readonly suggestions: CanvasAiSuggestionService) {}

  @Get()
  @ApiOperation({ summary: 'List AI suggestions for a canvas' })
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('canvasId', ParseUUIDPipe) canvasId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<CanvasAiSuggestion[]> {
    return this.suggestions.findByCanvas(canvasId, user.orgId, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific AI suggestion' })
  get(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<CanvasAiSuggestion> {
    return this.suggestions.findById(id, user.orgId, workspaceId);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept an AI suggestion' })
  accept(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<CanvasAiSuggestion> {
    return this.suggestions.accept(id, user.orgId, workspaceId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an AI suggestion' })
  reject(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<CanvasAiSuggestion> {
    return this.suggestions.reject(id, user.orgId, workspaceId);
  }
}
