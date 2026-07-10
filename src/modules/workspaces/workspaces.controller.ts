import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}
  @Post() create(@Body() dto: CreateWorkspaceDto, @Query('organizationId') organizationId: string, @CurrentUser() user: { id: string }) { return this.workspaces.create(dto, user.id, organizationId); }
  @Get() list(@CurrentUser() user: { id: string }) { return this.workspaces.list(user.id); }
  @Get(':workspaceId') get(@Param('workspaceId') id: string, @CurrentUser() user: { id: string }) { return this.workspaces.get(id, user.id); }
  @Patch(':workspaceId') update(@Param('workspaceId') id: string, @Body() dto: UpdateWorkspaceDto, @CurrentUser() user: { id: string }) { return this.workspaces.update(id, dto, user.id); }
  @Delete(':workspaceId') remove(@Param('workspaceId') id: string, @CurrentUser() user: { id: string }) { return this.workspaces.remove(id, user.id); }
  @Post(':workspaceId/archive') archive(@Param('workspaceId') id: string, @CurrentUser() user: { id: string }) { return this.workspaces.archive(id, user.id, true); }
  @Post(':workspaceId/restore') restore(@Param('workspaceId') id: string, @CurrentUser() user: { id: string }) { return this.workspaces.archive(id, user.id, false); }
  @Post(':workspaceId/duplicate') duplicate(@Param('workspaceId') id: string, @CurrentUser() user: { id: string }) { return this.workspaces.duplicate(id, user.id); }
}
