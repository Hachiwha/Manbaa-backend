import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import { Canvas } from "./canvas.entity";

export enum AiPreviewSnapshotStatus {
  PENDING = "pending",
  AVAILABLE = "available",
  SUPERSEDED = "superseded",
  FAILED = "failed",
}

export enum AiPreviewArtifactStatus {
  PENDING = "pending",
  AVAILABLE = "available",
}

@Entity("ai_preview_snapshot")
@Unique("uq_ai_preview_snapshot_canvas_version", [
  "canvasId",
  "snapshotVersion",
])
@Unique("uq_ai_preview_snapshot_storage", ["storageBucket", "storageKey"])
@Unique("uq_ai_preview_snapshot_lineage_identity", [
  "id",
  "canvasId",
  "snapshotVersion",
  "canvasRevision",
  "organizationId",
  "workspaceId",
])
@Index("idx_ai_preview_snapshot_tenant_created", [
  "organizationId",
  "workspaceId",
  "createdAt",
])
@Index("idx_ai_preview_snapshot_canvas_revision", [
  "canvasId",
  "canvasRevision",
])
@Check("ck_ai_preview_snapshot_version_positive", "snapshot_version > 0")
@Check("ck_ai_preview_snapshot_revision_nonnegative", "canvas_revision >= 0")
@Check("ck_ai_preview_snapshot_size_nonnegative", "size_bytes >= 0")
@Check("ck_ai_preview_snapshot_checksum", "checksum_sha256 ~ '^[0-9a-f]{64}$'")
@Check(
  "ck_ai_preview_snapshot_preview_consistency",
  "(preview_status = 'pending' AND preview_bucket IS NULL AND preview_key IS NULL AND preview_checksum_sha256 IS NULL) OR " +
    "(preview_status = 'available' AND preview_bucket = 'workspace-previews' AND preview_key IS NOT NULL AND preview_checksum_sha256 ~ '^[0-9a-f]{64}$')",
)
export class AiPreviewSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId: string;

  @Column({ name: "project_id", type: "uuid", nullable: true })
  projectId: string | null;

  @Column({ name: "canvas_id", type: "uuid" })
  canvasId: string;

  @Column({ name: "snapshot_version", type: "int" })
  snapshotVersion: number;

  @Column({ name: "canvas_revision", type: "bigint" })
  canvasRevision: number;

  @Column({
    type: "varchar",
    length: 32,
    default: AiPreviewSnapshotStatus.AVAILABLE,
  })
  status: AiPreviewSnapshotStatus;

  @Column({ name: "storage_bucket", type: "varchar", length: 255 })
  storageBucket: string;

  @Column({ name: "storage_key", type: "varchar", length: 1024 })
  storageKey: string;

  @Column({ name: "checksum_sha256", type: "varchar", length: 64 })
  checksumSha256: string;

  @Column({
    name: "content_type",
    type: "varchar",
    length: 255,
    default: "application/json",
  })
  contentType: string;

  @Column({ name: "size_bytes", type: "int" })
  sizeBytes: number;

  @Column({
    name: "preview_status",
    type: "varchar",
    length: 32,
    default: AiPreviewArtifactStatus.PENDING,
  })
  previewStatus: AiPreviewArtifactStatus;

  @Column({
    name: "preview_bucket",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  previewBucket: string | null;

  @Column({
    name: "preview_key",
    type: "varchar",
    length: 1024,
    nullable: true,
  })
  previewKey: string | null;

  @Column({
    name: "preview_checksum_sha256",
    type: "varchar",
    length: 64,
    nullable: true,
  })
  previewChecksumSha256: string | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "superseded_by_snapshot_id", type: "uuid", nullable: true })
  supersededBySnapshotId: string | null;

  @ManyToOne(() => Canvas, { onDelete: "CASCADE" })
  @JoinColumn({ name: "canvas_id" })
  canvas: Canvas;
}
