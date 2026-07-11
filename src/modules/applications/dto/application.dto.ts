import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApplicationStatus } from '../entities/application.entity';

export class CreateApplicationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  projectId: string;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ApplicationFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}

export class SaveDraftSchemaDto {
  @ApiProperty()
  @IsObject()
  schema: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schemaVersion?: string;

  @ApiPropertyOptional({ description: 'Required for optimistic concurrency. Fails with 409 if the stored revision differs.' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  expectedRevision?: number;
}

export class SaveDraftSchemaResponseDto {
  schema: Record<string, unknown>;
  revision: number;
}

export class CreateApplicationVersionDto {
  @ApiProperty()
  @IsString()
  schemaVersion: string;

  @ApiProperty()
  @IsObject()
  schema: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class DuplicateApplicationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ApplicationListResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: string;

  @ApiProperty()
  currentVersion: number;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
