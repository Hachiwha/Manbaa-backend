import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { JsonValue } from '../../../database/types/json-value.type';

@Entity('application_version')
@Index('idx_app_version_application_id', ['applicationId'])
export class ApplicationVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  applicationId: string;

  @Column({ type: 'integer' })
  versionNumber: number;

  @Column({ type: 'varchar', length: 20 })
  schemaVersion: string;

  @Column({ type: 'jsonb' })
  schema: JsonValue;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
