import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '../auth/entities/organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationMember, OrganizationRole } from './entities/organization-member.entity';
import { OrganizationPermissionService } from './organization-permission.service';
@Injectable()
export class OrganizationsV1Service {
  constructor(@InjectRepository(Organization) private readonly organizations: Repository<Organization>, @InjectRepository(OrganizationMember) private readonly members: Repository<OrganizationMember>, private readonly permissions: OrganizationPermissionService, private readonly dataSource: DataSource) {}
  create(dto: CreateOrganizationDto, userId: string) { return this.dataSource.transaction(async manager => { const org = await manager.save(manager.create(Organization, { name: dto.name })); await manager.save(manager.create(OrganizationMember, { organizationId: org.id, userId, role: OrganizationRole.OWNER, active: true })); return org; }); }
  list(userId: string) { return this.organizations.createQueryBuilder('o').innerJoin(OrganizationMember, 'm', 'm.organization_id=o.id AND m.user_id=:userId AND m.active=true', { userId }).orderBy('o.created_at', 'DESC').getMany(); }
  async get(id: string, userId: string) { await this.permissions.requireMember(userId, id); const org = await this.organizations.findOneBy({ id }); if (!org) throw new NotFoundException('Organization not found'); return org; }
  async update(id: string, dto: UpdateOrganizationDto, userId: string) { await this.permissions.requireRole(userId, id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]); const org = await this.get(id, userId); Object.assign(org, dto); return this.organizations.save(org); }
  async listMembers(id: string, userId: string) { await this.permissions.requireMember(userId, id); return this.members.find({ where: { organizationId: id, active: true }, order: { createdAt: 'ASC' } }); }
  async updateMember(id: string, memberId: string, role: OrganizationRole, userId: string) { const caller = await this.permissions.requireRole(userId, id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]); const member = await this.findMember(id, memberId); if (caller.role === OrganizationRole.ADMIN && member.role === OrganizationRole.OWNER) throw new ForbiddenException('Admins cannot modify owners'); if (member.role === OrganizationRole.OWNER && role !== OrganizationRole.OWNER) await this.assertAnotherOwner(id, member.id); member.role = role; return this.members.save(member); }
  async removeMember(id: string, memberId: string, userId: string) { const caller = await this.permissions.requireRole(userId, id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]); const member = await this.findMember(id, memberId); if (caller.role === OrganizationRole.ADMIN && member.role === OrganizationRole.OWNER) throw new ForbiddenException('Admins cannot remove owners'); if (member.role === OrganizationRole.OWNER) await this.assertAnotherOwner(id, member.id); member.active = false; await this.members.save(member); return { removed: true }; }
  private async findMember(organizationId: string, id: string) { const member = await this.members.findOne({ where: { id, organizationId, active: true } }); if (!member) throw new NotFoundException('Organization member not found'); return member; }
  private async assertAnotherOwner(organizationId: string, excludingId: string) { const count = await this.members.createQueryBuilder('m').where('m.organization_id=:organizationId AND m.role=:role AND m.active=true AND m.id<>:excludingId', { organizationId, role: OrganizationRole.OWNER, excludingId }).getCount(); if (count === 0) throw new BadRequestException('Cannot remove or downgrade the last organization owner'); }
}
