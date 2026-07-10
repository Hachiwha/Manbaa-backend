import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WorkspaceMember, WorkspaceMemberStatus, WorkspaceRole } from './entities/workspace-member.entity';
import { WorkspacePermissionService } from './workspace-permission.service';
@Injectable()
export class WorkspaceMembershipService {
  constructor(@InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>, private readonly permissions: WorkspacePermissionService, private readonly realtime: RealtimeGateway) {}
  async list(workspaceId: string, userId: string) { await this.permissions.requireMember(userId, workspaceId); return this.members.find({ where: { workspaceId }, order: { createdAt: 'ASC' } }); }
  async changeRole(workspaceId: string, memberId: string, role: WorkspaceRole, userId: string) { const caller = await this.permissions.requireRole(userId, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]); const target = await this.find(workspaceId, memberId); this.assertCanManage(caller, target); if (target.role === WorkspaceRole.OWNER && role !== WorkspaceRole.OWNER) await this.assertAnotherOwner(workspaceId, target.id); if (role === WorkspaceRole.OWNER && caller.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only owners can transfer ownership'); target.role = role; return this.members.save(target); }
  suspend(workspaceId: string, memberId: string, userId: string) { return this.setStatus(workspaceId, memberId, userId, WorkspaceMemberStatus.SUSPENDED); }
  restore(workspaceId: string, memberId: string, userId: string) { return this.setStatus(workspaceId, memberId, userId, WorkspaceMemberStatus.ACTIVE); }
  remove(workspaceId: string, memberId: string, userId: string) { return this.setStatus(workspaceId, memberId, userId, WorkspaceMemberStatus.REMOVED); }
  private async setStatus(workspaceId: string, memberId: string, userId: string, status: WorkspaceMemberStatus) { const caller = await this.permissions.requireRole(userId, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]); const target = await this.find(workspaceId, memberId); this.assertCanManage(caller, target); if (target.role === WorkspaceRole.OWNER && status !== WorkspaceMemberStatus.ACTIVE) await this.assertAnotherOwner(workspaceId, target.id); target.status = status; const saved = await this.members.save(target); if (status !== WorkspaceMemberStatus.ACTIVE) await this.realtime.disconnectWorkspaceMember(workspaceId, target.userId); return saved; }
  private assertCanManage(caller: WorkspaceMember, target: WorkspaceMember) { if (caller.role === WorkspaceRole.ADMIN && target.role === WorkspaceRole.OWNER) throw new ForbiddenException('Admins cannot modify owners'); }
  private async find(workspaceId: string, id: string) { const member = await this.members.findOne({ where: { id, workspaceId } }); if (!member) throw new NotFoundException('Workspace member not found'); return member; }
  private async assertAnotherOwner(workspaceId: string, excludingId: string) { const count = await this.members.createQueryBuilder('m').where('m.workspace_id=:workspaceId AND m.role=:role AND m.status=:status AND m.id<>:excludingId', { workspaceId, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, excludingId }).getCount(); if (!count) throw new BadRequestException('Cannot modify the last workspace owner'); }
}
