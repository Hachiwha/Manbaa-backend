import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { OrganizationMember } from "../organizations/entities/organization-member.entity";
import {
  WorkspaceMember,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from "./entities/workspace-member.entity";

const READ = Object.values(WorkspaceRole);
const EDIT = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR];
const COMMENT = [...EDIT, WorkspaceRole.COMMENTER];

@Injectable()
export class WorkspacePermissionService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(OrganizationMember)
    private readonly organizationMembers: Repository<OrganizationMember>,
  ) {}
  async requireMember(userId: string, workspaceId: string) {
    return this.requireRole(userId, workspaceId, READ);
  }
  async requireEditor(
    userId: string,
    workspaceId: string,
    organizationId: string,
  ) {
    const [organizationMember, member] = await Promise.all([
      this.organizationMembers.findOne({
        where: { userId, organizationId, active: true },
      }),
      this.members.findOne({
        where: {
          userId,
          workspaceId,
          organizationId,
          status: WorkspaceMemberStatus.ACTIVE,
          role: In(EDIT),
        },
      }),
    ]);
    if (!organizationMember || !member) {
      throw new ForbiddenException("Workspace access denied");
    }
    return member;
  }
  async requireRole(
    userId: string,
    workspaceId: string,
    roles: WorkspaceRole[],
  ) {
    const member = await this.members.findOne({
      where: {
        userId,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
        role: In(roles),
      },
    });
    if (!member) throw new ForbiddenException("Workspace access denied");
    return member;
  }
  canRead(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, READ);
  }
  canEdit(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, EDIT);
  }
  canComment(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, COMMENT);
  }
  canManageMembers(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
  }
  canApprove(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, EDIT);
  }
  canExport(userId: string, workspaceId: string) {
    return this.can(userId, workspaceId, EDIT);
  }
  private async can(
    userId: string,
    workspaceId: string,
    roles: WorkspaceRole[],
  ) {
    return this.members.exist({
      where: {
        userId,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
        role: In(roles),
      },
    });
  }
}
