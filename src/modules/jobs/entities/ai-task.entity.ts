import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum JobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  WAITING_FOR_USER = "waiting_for_user",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SUPERSEDED = "superseded",
  STALE = "stale",
}

@Entity("ai_task")
@Index("idx_ai_task_canvas_preview_lineage", [
  "organizationId",
  "workspaceId",
  "canvasId",
  "canvasRevision",
])
export class AiTask {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  organizationId: string;

  @Column({ type: "uuid" })
  workspaceId: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column()
  taskType: string;

  @Column({ type: "enum", enum: JobStatus, enumName: "job_status_enum" })
  status: JobStatus;

  @Column({ default: 0 })
  progress: number;

  @Column({ nullable: true })
  currentStep: string | null;

  @Column({ type: "jsonb" })
  requestPayload: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  resultPayload: Record<string, unknown> | null;

  @Column({ nullable: true })
  errorCode: string | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @Column()
  correlationId: string;

  @Column({ unique: true })
  idempotencyKey: string;

  @Column({ type: "uuid" })
  usageReservationId: string;

  @Column({ name: "canvas_id", type: "uuid", nullable: true })
  canvasId: string | null;

  @Column({ name: "snapshot_id", type: "uuid", nullable: true })
  snapshotId: string | null;

  @Column({ name: "snapshot_version", type: "integer", nullable: true })
  snapshotVersion: number | null;

  @Column({ name: "canvas_revision", type: "bigint", nullable: true })
  canvasRevision: number | null;

  @Column({ name: "superseded_by_task_id", type: "uuid", nullable: true })
  supersededByTaskId: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt: Date | null;
}
