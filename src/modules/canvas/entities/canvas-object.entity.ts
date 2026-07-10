import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { JsonValue } from "../../../database/types/json-value.type";

@Entity("canvas_object")
export class CanvasObject {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index("idx_canvas_object_canvas")
  canvasId: string;

  @Column({ type: "varchar", length: 64 })
  type: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  elsaType: string | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  label: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  properties: JsonValue;

  @Column({ type: "double precision", default: 0 })
  positionX: number;

  @Column({ type: "double precision", default: 0 })
  positionY: number;

  @Column({ type: "double precision", nullable: true })
  width: number | null;

  @Column({ type: "double precision", nullable: true })
  height: number | null;

  @Column({ type: "jsonb", nullable: true })
  style: JsonValue | null;

  @Column({ type: "boolean", default: false })
  isLocked: boolean;

  @Column({ type: "uuid", nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
