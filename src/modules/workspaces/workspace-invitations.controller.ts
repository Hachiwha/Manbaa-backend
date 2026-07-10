import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CreateWorkspaceInvitationDto } from './dto/invitation.dto';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
@Controller('v1')
export class WorkspaceInvitationsController {
  constructor(private readonly invitations: WorkspaceInvitationsService) {}
  @Post('workspaces/:workspaceId/invitations') create(@Param('workspaceId') id: string, @Body() dto: CreateWorkspaceInvitationDto, @CurrentUser() user:{id:string}) { return this.invitations.create(id,dto,user.id); }
  @Get('workspaces/:workspaceId/invitations') list(@Param('workspaceId') id:string,@CurrentUser() user:{id:string}) { return this.invitations.list(id,user.id); }
  @Delete('workspaces/:workspaceId/invitations/:invitationId') revoke(@Param('workspaceId') id:string,@Param('invitationId') invitationId:string,@CurrentUser() user:{id:string}) { return this.invitations.revoke(id,invitationId,user.id); }
  @Post('invitations/:token/accept') accept(@Param('token') token:string,@CurrentUser() user:{id:string}) { return this.invitations.accept(token,user.id); }
}
