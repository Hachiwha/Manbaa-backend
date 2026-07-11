import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import {
  CanvasAiPreviewRequestDto,
  CanvasAiPreviewResponseDto,
} from '../dto/canvas-ai-preview.dto';
import { CanvasAiPreviewService } from '../services/canvas-ai-preview.service';

type RequestUser = { id: string; orgId: string; role: string };

@ApiTags('canvas')
@ApiBearerAuth()
@Controller('v1/workspaces/:workspaceId/canvases/:canvasId/ai-preview')
export class CanvasAiPreviewController {
  constructor(private readonly previews: CanvasAiPreviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Freeze and queue an immutable canvas snapshot for AI validation',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Stable client key for an exact logical preview request',
  })
  @ApiCreatedResponse({ type: CanvasAiPreviewResponseDto })
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('canvasId', ParseUUIDPipe) canvasId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CanvasAiPreviewRequestDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CanvasAiPreviewResponseDto> {
    return this.previews.createExplicit(
      workspaceId,
      canvasId,
      dto,
      idempotencyKey,
      user,
    );
  }
}
