import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UpdateWorkspaceMemberDto } from './dto/workspace-member.dto';
import { WorkspaceMembershipService } from './workspace-membership.service';
@Controller('v1/workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(private readonly memberships: WorkspaceMembershipService) {}
  @Get() list(@Param('workspaceId') workspaceId: string, @CurrentUser() user: { id: string }) { return this.memberships.list(workspaceId, user.id); }
  @Patch(':memberId') update(@Param('workspaceId') workspaceId: string, @Param('memberId') id: string, @Body() dto: UpdateWorkspaceMemberDto, @CurrentUser() user: { id: string }) { return this.memberships.changeRole(workspaceId, id, dto.role, user.id); }
  @Delete(':memberId') remove(@Param('workspaceId') workspaceId: string, @Param('memberId') id: string, @CurrentUser() user: { id: string }) { return this.memberships.remove(workspaceId, id, user.id); }
  @Post(':memberId/suspend') suspend(@Param('workspaceId') workspaceId: string, @Param('memberId') id: string, @CurrentUser() user: { id: string }) { return this.memberships.suspend(workspaceId, id, user.id); }
  @Post(':memberId/restore') restore(@Param('workspaceId') workspaceId: string, @Param('memberId') id: string, @CurrentUser() user: { id: string }) { return this.memberships.restore(workspaceId, id, user.id); }
}
