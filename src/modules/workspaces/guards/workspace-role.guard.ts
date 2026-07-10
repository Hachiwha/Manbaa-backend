import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspacePermissionService } from '../workspace-permission.service';
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly permissions: WorkspacePermissionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const roles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [context.getHandler(), context.getClass()]);
    const workspaceId = request.params.workspaceId;
    request.workspaceMember = roles?.length ? await this.permissions.requireRole(request.user.id, workspaceId, roles) : await this.permissions.requireMember(request.user.id, workspaceId);
    return true;
  }
}
