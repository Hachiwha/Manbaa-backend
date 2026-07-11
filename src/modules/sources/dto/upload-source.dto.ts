import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

import { SourceProcessingStatus } from "../entities";

export class UploadSourceDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class SourceUploadResponseDto {
  @ApiProperty({ format: "uuid" })
  sourceId: string;

  @ApiProperty({ format: "uuid" })
  sourceVersionId: string;

  @ApiProperty({ example: 1 })
  versionNumber: number;

  @ApiProperty({ enum: SourceProcessingStatus })
  status: SourceProcessingStatus;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({ pattern: "^[0-9a-f]{64}$" })
  checksumSha256: string;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}
