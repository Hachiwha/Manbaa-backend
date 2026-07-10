import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ConceptStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  GENERATED = 'generated',
  FAILED = 'failed',
  EVALUATING = 'evaluating',
  EVALUATED = 'evaluated',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('concept')
export class Concept {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ConceptStatus,
    default: ConceptStatus.DRAFT,
  })
  status: ConceptStatus;

  @Column({ name: 'prompt', type: 'text', nullable: true })
  prompt: string | null;

  @Column({ name: 'generation_params', type: 'jsonb', nullable: true })
  generationParams: Record<string, unknown> | null;

  @Column({ name: 'result_data', type: 'jsonb', nullable: true })
  resultData: Record<string, unknown> | null;

  @Column({ name: 'evaluation_score', type: 'float', nullable: true })
  evaluationScore: number | null;

  @Column({ name: 'evaluation_feedback', type: 'text', nullable: true })
  evaluationFeedback: string | null;

  @Column({ name: 'version', type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
