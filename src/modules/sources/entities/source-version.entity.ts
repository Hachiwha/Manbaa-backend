import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

export enum SourceProcessingStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  EXTRACTED = "extracted",
  INDEXED = "indexed",
  FAILED = "failed",
}

@Entity("source_version")
@Unique("uq_source_version_number", ["sourceId", "versionNumber"])
@Unique("uq_source_version_storage", ["storageBucket", "storageKey"])
@Unique("uq_source_version_tenant_identity", [
  "id",
  "sourceId",
  "organizationId",
  "workspaceId",
])
@Index("idx_source_version_source_created", ["sourceId", "createdAt"])
@Index("idx_source_version_tenant_status", [
  "organizationId",
  "workspaceId",
  "processingStatus",
])
@Check("ck_source_version_number_positive", "version_number > 0")
@Check("ck_source_version_size_nonnegative", "size_bytes >= 0")
@Check(
  "ck_source_version_checksum_sha256",
  "checksum_sha256 ~ '^[0-9a-f]{64}$'",
)
export class SourceVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "source_id", type: "uuid" })
  sourceId: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId: string;

  @Column({ name: "version_number", type: "integer" })
  versionNumber: number;

  @Column({ name: "storage_bucket", type: "varchar", length: 63 })
  storageBucket: string;

  @Column({ name: "storage_key", type: "text" })
  storageKey: string;

  @Column({ type: "varchar", length: 255 })
  filename: string;

  @Column({ name: "mime_type", type: "varchar", length: 127 })
  mimeType: string;

  @Column({ name: "size_bytes", type: "integer" })
  sizeBytes: number;

  @Column({ name: "checksum_sha256", type: "char", length: 64 })
  checksumSha256: string;

  @Column({
    name: "processing_status",
    type: "enum",
    enum: SourceProcessingStatus,
    enumName: "source_processing_status_enum",
    default: SourceProcessingStatus.PENDING,
  })
  processingStatus: SourceProcessingStatus;

  @Column({ name: "extracted_at", type: "timestamptz", nullable: true })
  extractedAt: Date | null;

  @Column({ name: "indexed_at", type: "timestamptz", nullable: true })
  indexedAt: Date | null;

  @Column({
    name: "failure_code",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  failureCode: string | null;

  @Column({ name: "failure_message", type: "text", nullable: true })
  failureMessage: string | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
