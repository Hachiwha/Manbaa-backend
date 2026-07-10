import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

import { JsonValue } from "../../../database/types/json-value.type";

@Entity("canvas_operation")
export class CanvasOperation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  canvasId: string;

  @Column({ type: "uuid", nullable: true })
  canvasObjectId: string | null;

  @Column({ type: "uuid" })
  @Index("idx_canvas_operation_user")
  userId: string;

  @Column({ type: "varchar", length: 64 })
  opType: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  opPayload: JsonValue;

  @Column({ type: "jsonb", nullable: true })
  versionVector: JsonValue | null;

  @Column({ type: "bigint" })
  sequenceNumber: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
