import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationFilterDto,
  SaveDraftSchemaDto,
  CreateApplicationVersionDto,
  DuplicateApplicationDto,
} from './dto/application.dto';

type RequestUser = { id: string; orgId: string; role: string };

@ApiTags('applications')
@ApiBearerAuth()
@Controller('projects/:projectId/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new application in a project' })
  @ApiResponse({ status: 201, description: 'Application created' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateApplicationDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.create(
      { ...dto, projectId },
      caller.orgId,
      caller.id,
    );
    return { application };
  }

  @Get()
  @ApiOperation({ summary: 'List applications in a project' })
  @ApiResponse({ status: 200, description: 'Applications list' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() filter: ApplicationFilterDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const { applications, total } = await this.applicationsService.findAll(
      { ...filter, projectId },
      caller.orgId,
    );
    return {
      applications,
      total,
      page: filter.page ?? 1,
      limit: filter.limit ?? 20,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  async findOne(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.findOne(id, caller.orgId);
    return { application };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application metadata' })
  async update(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.update(id, dto, caller.orgId, caller.id);
    return { application };
  }

  @Post(':id/schema')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save or update the draft visual schema. Provide expectedRevision for optimistic concurrency control.' })
  @ApiResponse({ status: 200, description: 'Schema saved' })
  @ApiResponse({ status: 409, description: 'Schema revision conflict' })
  async saveDraftSchema(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDraftSchemaDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const { application, revision } = await this.applicationsService.saveDraftSchema(id, dto, caller.orgId, caller.id);
    return { application, revision };
  }

  @Get(':id/schema')
  @ApiOperation({ summary: 'Get the current draft schema' })
  async getDraftSchema(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.findOne(id, caller.orgId);
    return { schema: application.draftSchema };
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an immutable application version' })
  async createVersion(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateApplicationVersionDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const version = await this.applicationsService.createVersion(id, dto, caller.orgId, caller.id);
    return { version };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions of an application' })
  async findVersions(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const versions = await this.applicationsService.findVersions(id, caller.orgId);
    return { versions };
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific application version' })
  async findVersion(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const version = await this.applicationsService.findVersion(id, versionId, caller.orgId);
    return { version };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a version of the application' })
  async publishVersion(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('versionId') versionId: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const version = await this.applicationsService.publishVersion(id, versionId, caller.orgId, caller.id);
    return { version };
  }

  @Get(':id/published')
  @ApiOperation({ summary: 'Get the currently published version' })
  async getPublishedVersion(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const version = await this.applicationsService.getPublishedVersion(id, caller.orgId);
    return { version };
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate an application' })
  async duplicate(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateApplicationDto,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.duplicate(id, dto, caller.orgId, caller.id);
    return { application };
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish the application, reverting to draft status' })
  async unpublish(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    const application = await this.applicationsService.unpublishVersion(id, caller.orgId, caller.id);
    return { application };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive an application' })
  async archive(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ) {
    await this.applicationsService.archive(id, caller.orgId, caller.id);
  }
}
