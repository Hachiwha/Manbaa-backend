import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

export enum WorkspaceStage {
  CREATED = 'created', ONBOARDING = 'onboarding', COLLECTING_SOURCES = 'collecting_sources', RESEARCHING = 'researching',
  STRATEGY_READY = 'strategy_ready', DESIGNING = 'designing', CONCEPT_REVIEW = 'concept_review',
  BRAND_SYSTEM_READY = 'brand_system_ready', EXPORTED = 'exported', ARCHIVED = 'archived',
}

@Entity('workspace')
export class Workspace {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'enum', enum: WorkspaceStage, enumName: 'workspace_stage_enum', default: WorkspaceStage.CREATED }) stage: WorkspaceStage;
  @Column({ type: 'uuid', nullable: true }) thumbnailAssetId: string | null;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, unknown>;
  @Column({ type: 'uuid' }) createdBy: string;
  @Column({ type: 'boolean', default: false }) archived: boolean;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
