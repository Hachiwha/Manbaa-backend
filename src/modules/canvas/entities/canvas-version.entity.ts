import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("canvas_version")
export class CanvasVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  canvasId: string;

  @Column({ type: "uuid", nullable: true })
  workflowVersionId: string | null;

  @Column({ type: "uuid", nullable: true })
  snapshotId: string | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  label: string | null;

  @Column({ type: "varchar", length: 32, default: "draft" })
  type: string;

  @Column({ type: "uuid", nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
