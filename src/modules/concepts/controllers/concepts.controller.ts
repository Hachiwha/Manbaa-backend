import { Body, Controller, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { ConceptsService } from '../services/concepts.service';
import { CreateConceptDto, GenerateConceptDto, UpdateConceptDto, EvaluateConceptDto } from '../dto/concept.dto';

@ApiTags('concepts')
@ApiBearerAuth()
@Controller('v1/workspaces/:workspaceId/concepts')
export class ConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Get()
  @ApiOperation({ summary: 'List concepts in workspace' })
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() user: { orgId: string }) {
    return this.concepts.list(user.orgId, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a concept' })
  create(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Body() dto: CreateConceptDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.create(user.orgId, workspaceId, dto, user.id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a concept from prompt' })
  generate(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Body() dto: GenerateConceptDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.requestGeneration(user.orgId, workspaceId, dto, user.id);
  }

  @Get(':conceptId')
  @ApiOperation({ summary: 'Get a concept' })
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('conceptId', ParseUUIDPipe) conceptId: string, @CurrentUser() user: { orgId: string }) {
    return this.concepts.get(user.orgId, workspaceId, conceptId);
  }

  @Patch(':conceptId')
  @ApiOperation({ summary: 'Update a concept' })
  update(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('conceptId', ParseUUIDPipe) conceptId: string, @Body() dto: UpdateConceptDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.update(user.orgId, workspaceId, conceptId, dto, user.id);
  }

  @Post(':conceptId/evaluate')
  @ApiOperation({ summary: 'Evaluate a concept' })
  evaluate(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('conceptId', ParseUUIDPipe) conceptId: string, @Body() dto: EvaluateConceptDto, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.evaluate(user.orgId, workspaceId, conceptId, dto, user.id);
  }

  @Post(':conceptId/approve')
  @ApiOperation({ summary: 'Approve a concept' })
  approve(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('conceptId', ParseUUIDPipe) conceptId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.approve(user.orgId, workspaceId, conceptId, user.id);
  }

  @Post(':conceptId/reject')
  @ApiOperation({ summary: 'Reject a concept' })
  reject(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('conceptId', ParseUUIDPipe) conceptId: string, @CurrentUser() user: { orgId: string; id: string }) {
    return this.concepts.reject(user.orgId, workspaceId, conceptId, user.id);
  }
}
