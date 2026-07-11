import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AiSuggestionStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  STALE = 'stale',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

@Entity('canvas_ai_suggestion')
@Index('idx_ai_suggestion_tenant', ['organizationId', 'workspaceId'])
@Index('idx_ai_suggestion_canvas', ['canvasId', 'snapshotVersion'])
@Index('idx_ai_suggestion_task', ['taskId'])
export class CanvasAiSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'canvas_id', type: 'uuid' })
  canvasId: string;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string | null;

  @Column({ name: 'snapshot_version', type: 'int', nullable: true })
  snapshotVersion: number | null;

  @Column({ name: 'canvas_revision', type: 'bigint', nullable: true })
  canvasRevision: number | null;

  @Column({ name: 'result_type', type: 'varchar', length: 32 })
  resultType: string;

  @Column({ name: 'component_spec', type: 'jsonb', nullable: true })
  componentSpec: Record<string, unknown> | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'asset_version_id', type: 'uuid', nullable: true })
  assetVersionId: string | null;

  @Column({ type: 'varchar', length: 32, default: AiSuggestionStatus.QUEUED })
  status: AiSuggestionStatus;

  @Column({ name: 'enhanced_prompt', type: 'text', nullable: true })
  enhancedPrompt: string | null;

  @Column({ name: 'evidence_ids', type: 'jsonb', nullable: true })
  evidenceIds: string[] | null;

  @Column({ name: 'stale', type: 'boolean', default: false })
  stale: boolean;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
