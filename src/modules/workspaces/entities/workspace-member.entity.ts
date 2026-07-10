import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum WorkspaceRole { OWNER = 'owner', ADMIN = 'admin', EDITOR = 'editor', COMMENTER = 'commenter', VIEWER = 'viewer' }
export enum WorkspaceMemberStatus { ACTIVE = 'active', SUSPENDED = 'suspended', REMOVED = 'removed' }

@Entity('workspace_member')
export class WorkspaceMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'uuid' }) workspaceId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'enum', enum: WorkspaceRole, enumName: 'workspace_role_enum' }) role: WorkspaceRole;
  @Column({ type: 'enum', enum: WorkspaceMemberStatus, enumName: 'workspace_member_status_enum', default: WorkspaceMemberStatus.ACTIVE }) status: WorkspaceMemberStatus;
  @Column({ type: 'uuid', nullable: true }) invitedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) joinedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
