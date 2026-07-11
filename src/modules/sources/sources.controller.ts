import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { CurrentUser } from "../../core/decorators/current-user.decorator";
import { SourceUploadResponseDto, UploadSourceDto } from "./dto";
import { SourcesService } from "./sources.service";
import { MAX_SOURCE_FILE_SIZE_BYTES } from "./source-validation.util";

@ApiTags("sources")
@ApiBearerAuth()
@Controller("v1/workspaces/:workspaceId/sources")
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Upload and queue a workspace source for canonical processing",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiCreatedResponse({ type: SourceUploadResponseDto })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SOURCE_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: UploadSourceDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string; orgId: string },
  ): Promise<SourceUploadResponseDto> {
    return this.sources.upload(workspaceId, dto, file, user);
  }
}
