import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { JsonValue } from '../../../database/types/json-value.type';

export enum ApplicationStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('application')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status_enum',
    default: ApplicationStatus.DRAFT,
  })
  status: ApplicationStatus;

  @Column({ type: 'integer', default: 0 })
  currentVersion: number;

  @Column({ type: 'uuid' })
  @Index('idx_application_org_id')
  orgId: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'uuid' })
  @Index('idx_application_project_id')
  projectId: string;

  @Column({ type: 'integer', default: 1 })
  schemaRevision: number;

  @Column({ type: 'jsonb', nullable: true })
  draftSchema: JsonValue | null;

  @Column({ type: 'uuid', nullable: true })
  publishedVersionId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
