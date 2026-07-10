import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationMemberDto } from './dto/organization.dto';
import { OrganizationsV1Service } from './organizations-v1.service';
@Controller('v1/organizations')
export class OrganizationsV1Controller {
  constructor(private readonly organizations: OrganizationsV1Service) {}
  @Post() create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: { id: string }) { return this.organizations.create(dto, user.id); }
  @Get() list(@CurrentUser() user: { id: string }) { return this.organizations.list(user.id); }
  @Get(':organizationId') get(@Param('organizationId') id: string, @CurrentUser() user: { id: string }) { return this.organizations.get(id, user.id); }
  @Patch(':organizationId') update(@Param('organizationId') id: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: { id: string }) { return this.organizations.update(id, dto, user.id); }
  @Get(':organizationId/members') members(@Param('organizationId') id: string, @CurrentUser() user: { id: string }) { return this.organizations.listMembers(id, user.id); }
  @Patch(':organizationId/members/:memberId') updateMember(@Param('organizationId') id: string, @Param('memberId') memberId: string, @Body() dto: UpdateOrganizationMemberDto, @CurrentUser() user: { id: string }) { return this.organizations.updateMember(id, memberId, dto.role, user.id); }
  @Delete(':organizationId/members/:memberId') removeMember(@Param('organizationId') id: string, @Param('memberId') memberId: string, @CurrentUser() user: { id: string }) { return this.organizations.removeMember(id, memberId, user.id); }
}
