import { BeforeRemove, BeforeSoftRemove, BeforeUpdate, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('platform_audit_log')
export class PlatformAuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'uuid', nullable: true }) workspaceId: string | null;
  @Column({ type: 'uuid' }) actorId: string;
  @Column({ type: 'varchar', length: 160 }) action: string;
  @Column({ type: 'varchar', length: 100 }) entityType: string;
  @Column({ type: 'text' }) entityId: string;
  @Column({ type: 'jsonb', nullable: true }) before: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) after: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 128 }) correlationId: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @BeforeUpdate() @BeforeRemove() @BeforeSoftRemove() preventMutation(): never { throw new Error('platform audit rows are immutable'); }
}
