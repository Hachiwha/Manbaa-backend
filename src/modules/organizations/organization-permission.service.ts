import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrganizationMember, OrganizationRole } from './entities/organization-member.entity';
@Injectable()
export class OrganizationPermissionService {
  constructor(@InjectRepository(OrganizationMember) private readonly members: Repository<OrganizationMember>) {}
  async requireMember(userId: string, organizationId: string) {
    const member = await this.members.findOne({ where: { userId, organizationId, active: true } });
    if (!member) throw new ForbiddenException('Organization access denied');
    return member;
  }
  async requireRole(userId: string, organizationId: string, roles: OrganizationRole[]) {
    const member = await this.members.findOne({ where: { userId, organizationId, active: true, role: In(roles) } });
    if (!member) throw new ForbiddenException('Organization role required');
    return member;
  }
}
