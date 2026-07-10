import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WorkspaceRole } from './workspace-member.entity';
export enum InvitationStatus { PENDING='pending', ACCEPTED='accepted', EXPIRED='expired', REVOKED='revoked' }
@Entity('workspace_invitation')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'uuid' }) workspaceId: string;
  @Column({ type: 'citext' }) email: string;
  @Column({ type: 'enum', enum: WorkspaceRole, enumName: 'workspace_role_enum' }) role: WorkspaceRole;
  @Column({ type: 'text', unique: true }) tokenHash: string;
  @Column({ type: 'uuid' }) invitedBy: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'enum', enum: InvitationStatus, enumName: 'workspace_invitation_status_enum' }) status: InvitationStatus;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
