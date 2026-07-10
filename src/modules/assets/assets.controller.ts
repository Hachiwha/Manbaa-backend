import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto, GenerateAssetDto, UpdateAssetDto, VariationsAssetDto } from './dto';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('v1/workspaces/:workspaceId/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List assets in workspace' })
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.list(user.orgId, workspaceId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create asset metadata' })
  create(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Body() dto: CreateAssetDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.create(user.orgId, workspaceId, dto, user.id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Request asset generation' })
  generate(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Body() dto: GenerateAssetDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.requestGeneration(user.orgId, workspaceId, dto, user.id);
  }

  @Get(':assetId')
  @ApiOperation({ summary: 'Get an asset' })
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.getForUser(user.orgId, workspaceId, assetId, user.id);
  }

  @Patch(':assetId')
  @ApiOperation({ summary: 'Update asset metadata' })
  update(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.update(user.orgId, workspaceId, assetId, dto, user.id);
  }

  @Get(':assetId/versions')
  @ApiOperation({ summary: 'List asset versions' })
  versions(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.versions(user.orgId, workspaceId, assetId, user.id);
  }

  @Post(':assetId/variations')
  @ApiOperation({ summary: 'Request an asset variation' })
  variations(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: VariationsAssetDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.requestVariation(user.orgId, workspaceId, assetId, dto, user.id);
  }

  @Post(':assetId/approve')
  @ApiOperation({ summary: 'Approve an asset' })
  approve(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.approve(user.orgId, workspaceId, assetId, user.id);
  }

  @Post(':assetId/reject')
  @ApiOperation({ summary: 'Reject an asset' })
  reject(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.reject(user.orgId, workspaceId, assetId, user.id);
  }

  @Get(':assetId/download-url')
  @ApiOperation({ summary: 'Create a signed asset download URL' })
  downloadUrl(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.assets.createSignedDownloadUrl(user.orgId, workspaceId, assetId, user.id);
  }
}
