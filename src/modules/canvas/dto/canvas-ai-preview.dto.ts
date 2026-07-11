import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_AI_PREVIEW_ELEMENT_IDS = 100;
export const MAX_AI_PREVIEW_SOURCE_IDS = 100;
export const MAX_AI_PREVIEW_PROMPT_LENGTH = 4_000;
export const MAX_AI_PREVIEW_DIMENSION = 65_536;

export enum CanvasAiPreviewOperation {
  IMPROVE_CANVAS = 'improve_canvas',
  IMPROVE_SELECTION = 'improve_selection',
  GENERATE_COMPONENT = 'generate_component',
  GENERATE_IMAGE = 'generate_image',
}

const ELEMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class CanvasAiPreviewRequestDto {
  @ApiProperty({ enum: CanvasAiPreviewOperation })
  @IsEnum(CanvasAiPreviewOperation)
  operation: CanvasAiPreviewOperation;

  @ApiProperty({ minLength: 1, maxLength: MAX_AI_PREVIEW_PROMPT_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_AI_PREVIEW_PROMPT_LENGTH)
  @Matches(/\S/, { message: 'user_prompt must not be blank' })
  user_prompt: string;

  @ApiProperty({ type: [String], maxItems: MAX_AI_PREVIEW_ELEMENT_IDS })
  @IsArray()
  @ArrayMaxSize(MAX_AI_PREVIEW_ELEMENT_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(ELEMENT_ID_PATTERN, { each: true })
  selected_element_ids: string[];

  @ApiProperty({ type: [String], maxItems: MAX_AI_PREVIEW_ELEMENT_IDS })
  @IsArray()
  @ArrayMaxSize(MAX_AI_PREVIEW_ELEMENT_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(ELEMENT_ID_PATTERN, { each: true })
  locked_element_ids: string[];

  @ApiProperty({ type: [String], maxItems: MAX_AI_PREVIEW_ELEMENT_IDS })
  @IsArray()
  @ArrayMaxSize(MAX_AI_PREVIEW_ELEMENT_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(ELEMENT_ID_PATTERN, { each: true })
  editable_element_ids: string[];

  @ApiProperty({ type: [String], maxItems: MAX_AI_PREVIEW_SOURCE_IDS })
  @IsArray()
  @ArrayMaxSize(MAX_AI_PREVIEW_SOURCE_IDS)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  source_ids: string[];

  @ApiProperty({ minimum: 1, maximum: MAX_AI_PREVIEW_DIMENSION })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AI_PREVIEW_DIMENSION)
  desired_width: number;

  @ApiProperty({ minimum: 1, maximum: MAX_AI_PREVIEW_DIMENSION })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AI_PREVIEW_DIMENSION)
  desired_height: number;

  @ApiProperty({ enum: [false], default: false })
  @IsBoolean()
  @Equals(false)
  auto_apply: false;
}

export class CanvasAiPreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  snapshotId: string;

  @ApiProperty({ minimum: 1 })
  snapshotVersion: number;

  @ApiProperty({ minimum: 0 })
  canvasRevision: number;

  @ApiProperty({ example: 'queued' })
  status: string;
}
