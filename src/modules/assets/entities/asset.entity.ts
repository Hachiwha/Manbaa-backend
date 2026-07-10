import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AssetStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  GENERATED = 'generated',
  FAILED = 'failed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum AssetType {
  IMAGE = 'image',
  SVG = 'svg',
  MOCKUP = 'mockup',
  THUMBNAIL = 'thumbnail',
  DOCUMENT = 'document',
}

@Entity('asset')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'type', type: 'enum', enum: AssetType })
  type: AssetType;

  @Column({ name: 'status', type: 'enum', enum: AssetStatus, default: AssetStatus.DRAFT })
  status: AssetStatus;

  @Column({ name: 'prompt', type: 'text', nullable: true })
  prompt: string | null;

  @Column({ name: 'generation_params', type: 'jsonb', nullable: true })
  generationParams: Record<string, unknown> | null;

  @Column({ name: 'storage_key', type: 'varchar', nullable: true })
  storageKey: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 127, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize: number | null;

  @Column({ name: 'width', type: 'integer', nullable: true })
  width: number | null;

  @Column({ name: 'height', type: 'integer', nullable: true })
  height: number | null;

  @Column({ name: 'thumbnail_key', type: 'varchar', nullable: true })
  thumbnailKey: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'version', type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
