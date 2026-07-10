import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../entities/workspace-member.entity';
export const WORKSPACE_ROLES_KEY = 'workspace_roles';
export const WorkspaceRoles = (...roles: WorkspaceRole[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);
export const WorkspaceId = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().params.workspaceId);
