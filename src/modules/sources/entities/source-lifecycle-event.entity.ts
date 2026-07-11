import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

@Entity("source_lifecycle_event")
@Check(
  "ck_source_lifecycle_event_type",
  "event_type IN ('workspace.source.processing','workspace.source.extracted','workspace.source.indexed','workspace.source.failed')",
)
@Index("uq_source_lifecycle_token_jti", ["tokenJti"], { unique: true })
@Index("idx_source_lifecycle_tenant_source", [
  "organizationId",
  "workspaceId",
  "sourceId",
  "sourceVersionId",
])
export class SourceLifecycleEvent {
  @PrimaryColumn({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({ name: "event_type", type: "varchar", length: 100 })
  eventType: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId: string;

  @Column({ name: "source_id", type: "uuid" })
  sourceId: string;

  @Column({ name: "source_version_id", type: "uuid" })
  sourceVersionId: string;

  @Column({ name: "token_jti", type: "varchar", length: 255 })
  tokenJti: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
