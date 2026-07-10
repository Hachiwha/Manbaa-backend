import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

import { JsonValue } from "../../../database/types/json-value.type";

@Entity("canvas_snapshot")
export class CanvasSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  canvasId: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  snapshotData: JsonValue;

  @Column({ type: "uuid", nullable: true })
  createdBy: string | null;

  @Column({ type: "varchar", length: 64, default: "manual" })
  trigger: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
