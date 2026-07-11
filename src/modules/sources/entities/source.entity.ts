import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

export enum SourceKind {
  DOCUMENT = "document",
}

export enum SourceStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  EXTRACTED = "extracted",
  INDEXED = "indexed",
  FAILED = "failed",
}

@Entity("source")
@Unique("uq_source_tenant_identity", ["id", "organizationId", "workspaceId"])
@Index("idx_source_org_workspace", ["organizationId", "workspaceId"])
@Index("idx_source_tenant_status", ["organizationId", "workspaceId", "status"])
export class Source {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId: string;

  @Column({ name: "project_id", type: "uuid", nullable: true })
  projectId: string | null;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "enum", enum: SourceKind, enumName: "source_kind_enum" })
  kind: SourceKind;

  @Column({
    type: "enum",
    enum: SourceStatus,
    enumName: "source_status_enum",
    default: SourceStatus.PENDING,
  })
  status: SourceStatus;

  @Column({ name: "current_version_id", type: "uuid", nullable: true })
  currentVersionId: string | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;
}
