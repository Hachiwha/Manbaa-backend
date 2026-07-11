import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from "class-validator";

export const CANVAS_OPERATION_TYPES = [
  "object_create",
  "object_move",
  "object_resize",
  "object_delete",
  "object_relabel",
  "property_update",
  "edge_create",
  "edge_delete",
  "edge_reroute",
  "bulk_paste",
] as const;

export const MAX_CANVAS_OPERATION_PAYLOAD_BYTES = 65_536;

// ─── Canvas Object ─────────────────────────────────────────────────

export class CreateCanvasObjectDto {
  @ApiProperty({
    description:
      "Object type: activity, gateway, event, connector, annotation, group",
  })
  @IsString()
  type: string;

  @ApiProperty({
    required: false,
    description: "Elsa activity type, e.g. Elsa.HttpEndpoint",
  })
  @IsOptional()
  @IsString()
  elsa_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    required: false,
    description: "Configuration properties for the activity",
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiProperty({ description: "X coordinate on the canvas" })
  @IsNumber()
  position_x: number;

  @ApiProperty({ description: "Y coordinate on the canvas" })
  @IsNumber()
  position_y: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiProperty({ required: false, description: "Visual style overrides" })
  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;
}

export class UpdateCanvasObjectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  elsa_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position_x?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position_y?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;
}

export class MoveCanvasObjectDto {
  @ApiProperty({ description: "New X coordinate" })
  @IsNumber()
  position_x: number;

  @ApiProperty({ description: "New Y coordinate" })
  @IsNumber()
  position_y: number;
}

// ─── Canvas Operation ───────────────────────────────────────────────

export class CreateCanvasOperationDto {
  @ApiProperty({ format: "uuid", description: "Client-generated idempotency ID" })
  @IsUUID()
  operation_id: string;

  @ApiProperty({ minimum: 0, description: "Last server revision observed by the client" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  client_revision: number;

  @ApiProperty({ required: false, format: "uuid" })
  @IsOptional()
  @IsUUID()
  canvas_object_id?: string;

  @ApiProperty({
    description:
      "Operation type: object_create, object_move, object_resize, object_delete, object_relabel, property_update, edge_create, edge_delete, edge_reroute, bulk_paste",
  })
  @IsString()
  @IsIn(CANVAS_OPERATION_TYPES)
  @MaxLength(64)
  op_type: string;

  @ApiProperty({ description: "The delta payload for this operation" })
  @IsObject()
  op_payload: Record<string, unknown>;

  @ApiProperty({ required: false, description: "CRDT version vector" })
  @IsOptional()
  @IsObject()
  version_vector?: Record<string, unknown>;
}

// ─── Canvas Snapshot ────────────────────────────────────────────────

export class CreateCanvasSnapshotDto {
  @ApiProperty({
    required: false,
    default: "manual",
    description:
      "Snapshot trigger: manual, auto-save, pre-commit, pre-ai-generation",
  })
  @IsOptional()
  @IsString()
  trigger?: string;
}

// ─── Canvas Commit ──────────────────────────────────────────────────

export class CommitCanvasDto {
  @ApiProperty({
    required: false,
    description: "Human-readable label for this version",
  })
  @IsOptional()
  @IsString()
  label?: string;
}

// ─── Query / Filter ─────────────────────────────────────────────────

export class CanvasOperationFilterDto {
  @ApiProperty({
    required: false,
    description: "Only return operations after this sequence number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  since_sequence?: number;

  @ApiProperty({ required: false, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 200;
}
