import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

import { JsonValue } from "../../../database/types/json-value.type";

@Entity("canvas_operation")
@Index("idx_canvas_operation_tenant_revision", [
  "organizationId",
  "workspaceId",
  "canvasId",
  "sequenceNumber",
])
@Index("idx_canvas_operation_client_revision", ["canvasId", "clientRevision"])
@Check(
  "ck_canvas_operation_client_revision",
  "client_revision IS NULL OR client_revision >= 0",
)
export class CanvasOperation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  canvasId: string;

  /** Nullable only for operations created before the Phase 04 tenant model. */
  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId: string | null;

  /** Nullable only for operations created before the Phase 04 tenant model. */
  @Column({ name: "workspace_id", type: "uuid", nullable: true })
  workspaceId: string | null;

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

  /** Client's expected canvas revision for optimistic concurrency. */
  @Column({ name: "client_revision", type: "bigint", nullable: true })
  clientRevision: number | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
