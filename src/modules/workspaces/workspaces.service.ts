import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { Workspace, WorkspaceStage } from './entities/workspace.entity';
import { WorkspaceMember, WorkspaceMemberStatus, WorkspaceRole } from './entities/workspace-member.entity';
import { WorkspacePermissionService } from './workspace-permission.service';

@Injectable()
export class WorkspacesService {
  constructor(@InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>, private readonly permissions: WorkspacePermissionService, private readonly dataSource: DataSource) {}
  async create(dto: CreateWorkspaceDto, userId: string, organizationId: string) {
    const orgMember = await this.dataSource.getRepository(OrganizationMember).exist({ where: { organizationId, userId, active: true } });
    if (!orgMember) throw new NotFoundException('Organization not found');
    return this.dataSource.transaction(async manager => {
      const workspace = await manager.save(manager.create(Workspace, { ...dto, organizationId, createdBy: userId, stage: WorkspaceStage.CREATED, archived: false }));
      await manager.save(manager.create(WorkspaceMember, { organizationId, workspaceId: workspace.id, userId, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: new Date() }));
      return workspace;
    });
  }
  async list(userId: string) {
    return this.workspaces.createQueryBuilder('w').innerJoin(WorkspaceMember, 'm', 'm.workspace_id=w.id AND m.user_id=:userId AND m.status=:status', { userId, status: WorkspaceMemberStatus.ACTIVE }).andWhere('w.deleted_at IS NULL').orderBy('w.updated_at', 'DESC').getMany();
  }
  async get(id: string, userId: string) { await this.permissions.requireMember(userId, id); return this.find(id); }
  async update(id: string, dto: UpdateWorkspaceDto, userId: string) {
    await this.permissions.requireRole(userId, id, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    const workspace = await this.find(id);
    if (workspace.version !== dto.version) throw new ConflictException('Workspace was modified; reload and retry');
    Object.assign(workspace, Object.fromEntries(Object.entries(dto).filter(([key, value]) => key !== 'version' && value !== undefined)));
    return this.workspaces.save(workspace);
  }
  async archive(id: string, userId: string, archived: boolean) { await this.permissions.requireRole(userId, id, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]); const w = await this.find(id); w.archived = archived; w.stage = archived ? WorkspaceStage.ARCHIVED : WorkspaceStage.CREATED; return this.workspaces.save(w); }
  async remove(id: string, userId: string) { await this.permissions.requireRole(userId, id, [WorkspaceRole.OWNER]); const w = await this.find(id); await this.workspaces.softRemove(w); }
  async duplicate(id: string, userId: string) { const source = await this.get(id, userId); return this.create({ name: `${source.name} Copy`, description: source.description ?? undefined, settings: structuredClone(source.settings) }, userId, source.organizationId); }
  private async find(id: string) { const w = await this.workspaces.findOne({ where: { id } }); if (!w) throw new NotFoundException('Workspace not found'); return w; }
}
