import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { User } from '../auth/entities/user.entity';
import { OrgMemberGuard } from './org-member.guard';
import { OrganizationMailerService } from './organization-mailer.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationMember } from './entities/organization-member.entity';
import { Organization } from '../auth/entities/organization.entity';
import { OrganizationsV1Controller } from './organizations-v1.controller';
import { OrganizationsV1Service } from './organizations-v1.service';
import { OrganizationPermissionService } from './organization-permission.service';
import { OrganizationMemberGuard } from './organization-member.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, OrganizationMember, Organization]), AuditModule],
  controllers: [OrganizationsController, OrganizationsV1Controller],
  providers: [OrganizationsService, OrganizationsV1Service, OrganizationPermissionService, OrganizationMemberGuard, OrgMemberGuard, OrganizationMailerService],
  exports: [OrganizationsService, OrganizationsV1Service, OrganizationPermissionService, OrganizationMemberGuard],
})
export class OrganizationsModule {}
