import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { OrganizationPermissionService } from './organization-permission.service';
@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(private readonly permissions: OrganizationPermissionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.organizationMember = await this.permissions.requireMember(request.user.id, request.params.organizationId);
    return true;
  }
}
