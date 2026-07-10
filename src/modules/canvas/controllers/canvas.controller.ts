import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../../../core/decorators/current-user.decorator";
import { Canvas } from "../entities/canvas.entity";
import { CanvasObject } from "../entities/canvas-object.entity";
import { CanvasOperation } from "../entities/canvas-operation.entity";
import { CanvasSnapshot } from "../entities/canvas-snapshot.entity";
import { CanvasVersion } from "../entities/canvas-version.entity";
import { CanvasService } from "../services/canvas.service";
import {
  CreateCanvasObjectDto,
  UpdateCanvasObjectDto,
  MoveCanvasObjectDto,
  CreateCanvasOperationDto,
  CreateCanvasSnapshotDto,
  CommitCanvasDto,
  CanvasOperationFilterDto,
} from "../dto/canvas.dto";

type RequestUser = { id: string; orgId: string; role: string };

@ApiTags("canvas")
@ApiBearerAuth()
@Controller("workflows/:workflowId/canvas")
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  @ApiOperation({ summary: "Get or create the canvas for a workflow" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 200, description: "Canvas retrieved" })
  async getCanvas(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ canvas: Canvas }> {
    const canvas = await this.canvasService.getOrCreateCanvas(
      workflowId,
      caller.orgId,
    );
    return { canvas };
  }

  @Get("objects")
  @ApiOperation({ summary: "List all objects on the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 200, description: "Canvas objects retrieved" })
  async listObjects(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ objects: CanvasObject[] }> {
    const objects = await this.canvasService.getObjects(
      workflowId,
      caller.orgId,
    );
    return { objects };
  }

  @Post("objects")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new object on the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 201, description: "Canvas object created" })
  async createObject(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateCanvasObjectDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ object: CanvasObject }> {
    const obj = await this.canvasService.createObject(workflowId, dto, caller);
    return { object: obj };
  }

  @Post("operations")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Record a canvas operation (for OT/CRDT replay)" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 201, description: "Operation recorded" })
  async createOperation(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateCanvasOperationDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ operation: CanvasOperation }> {
    const op = await this.canvasService.createOperation(
      workflowId,
      dto,
      caller,
    );
    return { operation: op };
  }

  @Get("operations")
  @ApiOperation({ summary: "Get operation history for the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 200, description: "Operation history retrieved" })
  async getOperationHistory(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @Query() filter: CanvasOperationFilterDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ operations: CanvasOperation[] }> {
    return this.canvasService.getOperationHistory(
      workflowId,
      filter,
      caller.orgId,
    );
  }

  @Get("snapshots")
  @ApiOperation({ summary: "List all snapshots for the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 200, description: "Snapshots retrieved" })
  async getSnapshots(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ snapshots: CanvasSnapshot[] }> {
    const snapshots = await this.canvasService.getSnapshots(
      workflowId,
      caller.orgId,
    );
    return { snapshots };
  }

  @Post("snapshots")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a point-in-time snapshot of the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 201, description: "Snapshot created" })
  async createSnapshot(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @Body() dto: CreateCanvasSnapshotDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ snapshot: CanvasSnapshot }> {
    const snapshot = await this.canvasService.createSnapshot(
      workflowId,
      dto,
      caller,
    );
    return { snapshot };
  }

  @Get("versions")
  @ApiOperation({ summary: "List all committed versions of the canvas" })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({ status: 200, description: "Canvas versions retrieved" })
  async getVersions(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ versions: CanvasVersion[] }> {
    const versions = await this.canvasService.getVersions(
      workflowId,
      caller.orgId,
    );
    return { versions };
  }

  @Post("commit")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Commit the current canvas state as a new workflow version",
  })
  @ApiParam({ name: "workflowId", description: "UUID of the workflow" })
  @ApiResponse({
    status: 201,
    description: "Canvas committed as workflow version",
  })
  async commitCanvas(
    @Param("workflowId", ParseUUIDPipe) workflowId: string,
    @Body() dto: CommitCanvasDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ version: CanvasVersion }> {
    const version = await this.canvasService.commitCanvas(
      workflowId,
      dto,
      caller,
    );
    return { version };
  }
}

@ApiTags("canvas")
@ApiBearerAuth()
@Controller("canvas")
export class CanvasObjectController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get("objects/:objectId")
  @ApiOperation({ summary: "Get a single canvas object" })
  @ApiParam({ name: "objectId", description: "UUID of the canvas object" })
  @ApiResponse({ status: 200, description: "Canvas object retrieved" })
  async getObject(
    @Param("objectId", ParseUUIDPipe) objectId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ object: CanvasObject }> {
    const obj = await this.canvasService.getObject(objectId, caller.orgId);
    return { object: obj };
  }

  @Patch("objects/:objectId")
  @ApiOperation({ summary: "Update a canvas object" })
  @ApiParam({ name: "objectId", description: "UUID of the canvas object" })
  @ApiResponse({ status: 200, description: "Canvas object updated" })
  async updateObject(
    @Param("objectId", ParseUUIDPipe) objectId: string,
    @Body() dto: UpdateCanvasObjectDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ object: CanvasObject }> {
    const obj = await this.canvasService.updateObject(objectId, dto, caller);
    return { object: obj };
  }

  @Patch("objects/:objectId/move")
  @ApiOperation({ summary: "Move a canvas object to a new position" })
  @ApiParam({ name: "objectId", description: "UUID of the canvas object" })
  @ApiResponse({ status: 200, description: "Canvas object moved" })
  async moveObject(
    @Param("objectId", ParseUUIDPipe) objectId: string,
    @Body() dto: MoveCanvasObjectDto,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ object: CanvasObject }> {
    const obj = await this.canvasService.moveObject(objectId, dto, caller);
    return { object: obj };
  }

  @Delete("objects/:objectId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a canvas object" })
  @ApiParam({ name: "objectId", description: "UUID of the canvas object" })
  @ApiResponse({ status: 204, description: "Canvas object deleted" })
  async deleteObject(
    @Param("objectId", ParseUUIDPipe) objectId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<void> {
    await this.canvasService.deleteObject(objectId, caller);
  }

  @Get("snapshots/:snapshotId")
  @ApiOperation({ summary: "Get a single canvas snapshot" })
  @ApiParam({ name: "snapshotId", description: "UUID of the snapshot" })
  @ApiResponse({ status: 200, description: "Canvas snapshot retrieved" })
  async getSnapshot(
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ snapshot: CanvasSnapshot }> {
    const snapshot = await this.canvasService.getSnapshot(
      snapshotId,
      caller.orgId,
    );
    return { snapshot };
  }

  @Get("versions/:versionId")
  @ApiOperation({ summary: "Get a single canvas version" })
  @ApiParam({ name: "versionId", description: "UUID of the canvas version" })
  @ApiResponse({ status: 200, description: "Canvas version retrieved" })
  async getVersion(
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<{ version: CanvasVersion }> {
    const version = await this.canvasService.getVersion(
      versionId,
      caller.orgId,
    );
    return { version };
  }
}
