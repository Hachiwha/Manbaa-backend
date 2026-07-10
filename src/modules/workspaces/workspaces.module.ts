import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspacePermissionService } from './workspace-permission.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkspaceMembershipService } from './workspace-membership.service';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { WorkspaceInvitationsController } from './workspace-invitations.controller';
import { User } from '../auth/entities/user.entity';
@Module({ imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceInvitation, OrganizationMember, User]), RealtimeModule], controllers: [WorkspacesController, WorkspaceMembersController, WorkspaceInvitationsController], providers: [WorkspacesService, WorkspaceMembershipService, WorkspaceInvitationsService, WorkspacePermissionService, WorkspaceRoleGuard], exports: [WorkspacesService, WorkspaceMembershipService, WorkspaceInvitationsService, WorkspacePermissionService, WorkspaceRoleGuard] })
export class WorkspacesModule {}
