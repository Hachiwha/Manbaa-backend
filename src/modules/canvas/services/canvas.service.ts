import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { isDeepStrictEqual } from "util";

import { ActorType, UserRole } from "../../../database/enums";
import { AuditService } from "../../audit/audit.service";
import { Workflow } from "../../workflows/entities/workflow.entity";
import { WorkflowVersion } from "../../workflows/entities/workflow-version.entity";
import { WorkspacePermissionService } from "../../workspaces/workspace-permission.service";
import { CanvasRealtimeService } from "./canvas-realtime.service";
import { Canvas } from "../entities/canvas.entity";
import { CanvasObject } from "../entities/canvas-object.entity";
import { CanvasOperation } from "../entities/canvas-operation.entity";
import { CanvasSnapshot } from "../entities/canvas-snapshot.entity";
import { CanvasVersion } from "../entities/canvas-version.entity";
import {
  CreateCanvasObjectDto,
  UpdateCanvasObjectDto,
  MoveCanvasObjectDto,
  CreateCanvasOperationDto,
  CreateCanvasSnapshotDto,
  CommitCanvasDto,
  CanvasOperationFilterDto,
  MAX_CANVAS_OPERATION_PAYLOAD_BYTES,
} from "../dto/canvas.dto";

type RequestUser = {
  id: string;
  orgId: string;
  role: string;
};

class CanvasRevisionConflict extends Error {
  constructor(readonly currentRevision: number) {
    super("Canvas revision conflict");
  }
}

@Injectable()
export class CanvasService {
  constructor(
    @InjectRepository(Canvas)
    private readonly canvasRepository: Repository<Canvas>,
    @InjectRepository(CanvasObject)
    private readonly canvasObjectRepository: Repository<CanvasObject>,
    @InjectRepository(CanvasOperation)
    private readonly canvasOperationRepository: Repository<CanvasOperation>,
    @InjectRepository(CanvasSnapshot)
    private readonly canvasSnapshotRepository: Repository<CanvasSnapshot>,
    @InjectRepository(CanvasVersion)
    private readonly canvasVersionRepository: Repository<CanvasVersion>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowVersion)
    private readonly workflowVersionRepository: Repository<WorkflowVersion>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly realtime: CanvasRealtimeService,
    private readonly workspacePermissions: WorkspacePermissionService,
  ) {}

  // ─── Canvas ───────────────────────────────────────────────────────
  //
  // The 1:1 Canvas-to-Workflow relationship enforced by getOrCreateCanvas
  // is an implementation assumption — the project specification does not
  // explicitly define this cardinality. See the Canvas entity JSDoc for
  // details on evolving to 1:N with a non-breaking migration.

  async getOrCreateCanvas(workflowId: string, orgId: string): Promise<Canvas> {
    const workflow = await this.findWorkflowInOrgOrThrow(workflowId, orgId);

    const existing = await this.canvasRepository.findOne({
      where: { workflowId: workflow.id },
    });

    if (existing) return existing;

    const canvas = this.canvasRepository.create({ workflowId: workflow.id });
    const saved = await this.canvasRepository.save(canvas);

    await this.auditService.log({
      workflowId: workflow.id,
      actorId: null,
      actorType: ActorType.SYSTEM,
      eventType: "CANVAS_CREATED",
      beforeState: null,
      afterState: { canvas_id: saved.id },
    });

    return saved;
  }

  async getCanvas(workflowId: string, orgId: string): Promise<Canvas> {
    const workflow = await this.findWorkflowInOrgOrThrow(workflowId, orgId);

    const canvas = await this.canvasRepository.findOne({
      where: { workflowId: workflow.id },
    });

    if (!canvas) {
      throw new NotFoundException("Canvas not found for this workflow");
    }

    return canvas;
  }

  // ─── Canvas Objects ───────────────────────────────────────────────

  async createObject(
    workflowId: string,
    dto: CreateCanvasObjectDto,
    caller: RequestUser,
  ): Promise<CanvasObject> {
    const canvas = await this.getOrCreateCanvas(workflowId, caller.orgId);
    await this.requireCanvasMutationPermission(canvas, caller);

    const saved = await this.dataSource.transaction(async (manager) => {
      const lockedCanvas = await this.lockCanvas(manager, canvas.id);
      const object = manager.create(CanvasObject, {
        canvasId: canvas.id,
        type: dto.type,
        elsaType: dto.elsa_type ?? null,
        label: dto.label ?? null,
        properties: dto.properties ?? {},
        positionX: dto.position_x,
        positionY: dto.position_y,
        width: dto.width ?? null,
        height: dto.height ?? null,
        style: dto.style ?? null,
        isLocked: false,
        createdBy: caller.id,
      });
      const savedObject = await manager.save(object);
      await this.appendOperationWithLockedCanvas(
        manager,
        lockedCanvas,
        savedObject.id,
        caller.id,
        "object_create",
        {
          type: savedObject.type,
          elsa_type: savedObject.elsaType,
          label: savedObject.label,
          position_x: savedObject.positionX,
          position_y: savedObject.positionY,
        },
      );
      return savedObject;
    });

    await this.auditService.log({
      workflowId,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_CREATED",
      elementId: saved.id,
      beforeState: null,
      afterState: { type: saved.type, label: saved.label },
    });

    this.realtime.broadcastObjectCreated(canvas.id, workflowId, saved);

    return saved;
  }

  async updateObject(
    objectId: string,
    dto: UpdateCanvasObjectDto,
    caller: RequestUser,
  ): Promise<CanvasObject> {
    const existing = await this.findObjectInOrgOrThrow(objectId, caller.orgId);
    const canvas = await this.findCanvasOrThrow(existing.canvasId);
    await this.requireCanvasMutationPermission(canvas, caller);

    const { saved, beforeState } = await this.dataSource.transaction(
      async (manager) => {
        const lockedCanvas = await this.lockCanvas(manager, canvas.id);
        const object = await manager.findOne(CanvasObject, {
          where: { id: objectId, canvasId: canvas.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!object) throw new NotFoundException("Canvas object not found");
        if (object.isLocked && caller.role !== UserRole.ADMIN) {
          throw new ForbiddenException("Cannot modify a locked object");
        }
        const original = {
          label: object.label,
          position_x: object.positionX,
          position_y: object.positionY,
          width: object.width,
          height: object.height,
        };
        if (dto.label !== undefined) object.label = dto.label;
        if (dto.elsa_type !== undefined) object.elsaType = dto.elsa_type;
        if (dto.properties !== undefined) object.properties = dto.properties;
        if (dto.position_x !== undefined) object.positionX = dto.position_x;
        if (dto.position_y !== undefined) object.positionY = dto.position_y;
        if (dto.width !== undefined) object.width = dto.width;
        if (dto.height !== undefined) object.height = dto.height;
        if (dto.style !== undefined) object.style = dto.style;
        const savedObject = await manager.save(object);
        await this.appendOperationWithLockedCanvas(
          manager,
          lockedCanvas,
          savedObject.id,
          caller.id,
          "object_update",
          {
            label: savedObject.label,
            position_x: savedObject.positionX,
            position_y: savedObject.positionY,
            width: savedObject.width,
            height: savedObject.height,
          },
        );
        return { saved: savedObject, beforeState: original };
      },
    );

    await this.auditService.log({
      workflowId:
        (await this.resolveWorkflowId(existing.canvasId, caller.orgId)) ??
        undefined,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_UPDATED",
      elementId: saved.id,
      beforeState,
      afterState: {
        label: saved.label,
        position_x: saved.positionX,
        position_y: saved.positionY,
      },
    });

    this.realtime.broadcastObjectUpdated(
      existing.canvasId,
      (await this.resolveWorkflowId(existing.canvasId, caller.orgId))!,
      saved,
    );

    return saved;
  }

  async moveObject(
    objectId: string,
    dto: MoveCanvasObjectDto,
    caller: RequestUser,
  ): Promise<CanvasObject> {
    const existing = await this.findObjectInOrgOrThrow(objectId, caller.orgId);
    const canvas = await this.findCanvasOrThrow(existing.canvasId);
    await this.requireCanvasMutationPermission(canvas, caller);

    const { saved, beforeState } = await this.dataSource.transaction(
      async (manager) => {
        const lockedCanvas = await this.lockCanvas(manager, canvas.id);
        const object = await manager.findOne(CanvasObject, {
          where: { id: objectId, canvasId: canvas.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!object) throw new NotFoundException("Canvas object not found");
        if (object.isLocked && caller.role !== UserRole.ADMIN) {
          throw new ForbiddenException("Cannot move a locked object");
        }
        const original = {
          position_x: object.positionX,
          position_y: object.positionY,
        };
        object.positionX = dto.position_x;
        object.positionY = dto.position_y;
        const savedObject = await manager.save(object);
        await this.appendOperationWithLockedCanvas(
          manager,
          lockedCanvas,
          savedObject.id,
          caller.id,
          "object_move",
          {
            position_x: savedObject.positionX,
            position_y: savedObject.positionY,
          },
        );
        return { saved: savedObject, beforeState: original };
      },
    );

    await this.auditService.log({
      workflowId:
        (await this.resolveWorkflowId(existing.canvasId, caller.orgId)) ??
        undefined,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_MOVED",
      elementId: saved.id,
      beforeState,
      afterState: {
        position_x: saved.positionX,
        position_y: saved.positionY,
      },
    });

    this.realtime.broadcastObjectMoved(
      existing.canvasId,
      (await this.resolveWorkflowId(existing.canvasId, caller.orgId))!,
      saved,
    );

    return saved;
  }

  async deleteObject(
    objectId: string,
    caller: RequestUser,
  ): Promise<{ deleted: boolean }> {
    const existing = await this.findObjectInOrgOrThrow(objectId, caller.orgId);
    const canvas = await this.findCanvasOrThrow(existing.canvasId);
    await this.requireCanvasMutationPermission(canvas, caller);

    const deleted = await this.dataSource.transaction(async (manager) => {
      const lockedCanvas = await this.lockCanvas(manager, canvas.id);
      const object = await manager.findOne(CanvasObject, {
        where: { id: objectId, canvasId: canvas.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!object) throw new NotFoundException("Canvas object not found");
      if (object.isLocked && caller.role !== UserRole.ADMIN) {
        throw new ForbiddenException("Cannot delete a locked object");
      }
      await manager.remove(object);
      await this.appendOperationWithLockedCanvas(
        manager,
        lockedCanvas,
        objectId,
        caller.id,
        "object_delete",
        { type: object.type, label: object.label },
      );
      return object;
    });

    const deletedWorkflowId = await this.resolveWorkflowId(
      deleted.canvasId,
      caller.orgId,
    );

    await this.auditService.log({
      workflowId: deletedWorkflowId ?? undefined,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_DELETED",
      elementId: objectId,
      beforeState: { type: deleted.type, label: deleted.label },
      afterState: null,
    });

    this.realtime.broadcastObjectDeleted(
      deleted.canvasId,
      deletedWorkflowId!,
      objectId,
    );

    return { deleted: true };
  }

  async getObjects(workflowId: string, orgId: string): Promise<CanvasObject[]> {
    const canvas = await this.getCanvas(workflowId, orgId);

    return this.canvasObjectRepository.find({
      where: { canvasId: canvas.id },
      order: { createdAt: "ASC" },
    });
  }

  async getObject(objectId: string, orgId: string): Promise<CanvasObject> {
    return this.findObjectInOrgOrThrow(objectId, orgId);
  }

  // ─── Canvas Operations ────────────────────────────────────────────

  async appendOperation(
    canvasId: string,
    canvasObjectId: string | null,
    userId: string,
    opType: string,
    opPayload: Record<string, unknown>,
    versionVector?: Record<string, unknown>,
  ): Promise<CanvasOperation> {
    return this.dataSource.transaction(async (manager) => {
      const canvas = await this.lockCanvas(manager, canvasId);
      return this.appendOperationWithLockedCanvas(
        manager,
        canvas,
        canvasObjectId,
        userId,
        opType,
        opPayload,
        versionVector,
      );
    });
  }

  async createOperation(
    workflowId: string,
    dto: CreateCanvasOperationDto,
    caller: RequestUser,
  ): Promise<CanvasOperation> {
    const canvas = await this.getOrCreateCanvas(workflowId, caller.orgId);
    await this.requireCanvasMutationPermission(canvas, caller);
    this.assertOperationPayloadBounded(dto.op_payload);

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(Canvas, {
          where: { id: canvas.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!locked) throw new NotFoundException("Canvas not found");

        const existing = await manager.findOne(CanvasOperation, {
          where: { id: dto.operation_id },
        });
        if (existing) {
          const sameLogicalOperation =
            existing.canvasId === canvas.id &&
            existing.canvasObjectId === (dto.canvas_object_id ?? null) &&
            existing.userId === caller.id &&
            existing.opType === dto.op_type &&
            Number(existing.sequenceNumber) === dto.client_revision + 1 &&
            existing.organizationId === caller.orgId &&
            existing.workspaceId === canvas.workspaceId &&
            Number(existing.clientRevision) === dto.client_revision &&
            isDeepStrictEqual(existing.opPayload, dto.op_payload) &&
            isDeepStrictEqual(
              existing.versionVector,
              dto.version_vector ?? null,
            );
          if (!sameLogicalOperation) {
            throw new ConflictException(
              "Operation ID is already used by a different operation",
            );
          }
          return { operation: existing, duplicate: true, canvas: locked };
        }

        const currentRevision = Number(locked.revision);
        if (dto.client_revision !== currentRevision) {
          throw new CanvasRevisionConflict(currentRevision);
        }

        if (dto.canvas_object_id) {
          const objectExists = await manager.exists(CanvasObject, {
            where: { id: dto.canvas_object_id, canvasId: canvas.id },
          });
          if (!objectExists) {
            throw new BadRequestException(
              "Canvas object does not belong to this canvas",
            );
          }
        }

        const nextRevision = currentRevision + 1;
        const operation = manager.create(CanvasOperation, {
          id: dto.operation_id,
          canvasId: canvas.id,
          organizationId: caller.orgId,
          workspaceId: locked.workspaceId,
          canvasObjectId: dto.canvas_object_id ?? null,
          userId: caller.id,
          opType: dto.op_type,
          opPayload: dto.op_payload,
          versionVector: dto.version_vector ?? null,
          sequenceNumber: nextRevision,
          clientRevision: dto.client_revision,
        });
        const saved = await manager.save(operation);
        locked.revision = nextRevision;
        await manager.save(locked);
        return { operation: saved, duplicate: false, canvas: locked };
      });

      if (!result.duplicate && result.canvas.workspaceId) {
        this.realtime.broadcastOperationAccepted({
          organization_id: caller.orgId,
          workspace_id: result.canvas.workspaceId,
          canvas_id: canvas.id,
          operation_id: result.operation.id,
          actor_id: caller.id,
          canvas_revision: Number(result.operation.sequenceNumber),
          occurred_at:
            result.operation.createdAt?.toISOString() ?? new Date().toISOString(),
        });
      }
      return result.operation;
    } catch (error) {
      if (error instanceof CanvasRevisionConflict) {
        if (canvas.workspaceId) {
          this.realtime.broadcastOperationRejected({
            organization_id: caller.orgId,
            workspace_id: canvas.workspaceId,
            canvas_id: canvas.id,
            operation_id: dto.operation_id,
            actor_id: caller.id,
            client_revision: dto.client_revision,
            current_revision: error.currentRevision,
            code: "CANVAS_REVISION_CONFLICT",
            occurred_at: new Date().toISOString(),
          });
        }
        throw new ConflictException({
          code: "CANVAS_REVISION_CONFLICT",
          message: "Canvas revision is stale",
          currentRevision: error.currentRevision,
        });
      }
      throw error;
    }
  }

  async getOperationHistory(
    workflowId: string,
    filter: CanvasOperationFilterDto,
    orgId: string,
  ): Promise<{ operations: CanvasOperation[] }> {
    const canvas = await this.getCanvas(workflowId, orgId);

    const qb = this.canvasOperationRepository
      .createQueryBuilder("op")
      .where("op.canvas_id = :canvasId", { canvasId: canvas.id });

    if (filter.since_sequence !== undefined) {
      qb.andWhere("op.sequence_number > :since", {
        since: filter.since_sequence,
      });
    }

    const operations = await qb
      .orderBy("op.sequence_number", "ASC")
      .take(filter.limit ?? 200)
      .getMany();

    return { operations };
  }

  // ─── Canvas Snapshots ─────────────────────────────────────────────

  async createSnapshot(
    workflowId: string,
    dto: CreateCanvasSnapshotDto,
    caller: RequestUser,
  ): Promise<CanvasSnapshot> {
    const canvas = await this.getCanvas(workflowId, caller.orgId);

    const objects = await this.canvasObjectRepository.find({
      where: { canvasId: canvas.id },
      order: { createdAt: "ASC" },
    });

    const snapshotData = this.buildSnapshotData(objects);

    const snapshot = this.canvasSnapshotRepository.create({
      canvasId: canvas.id,
      snapshotData,
      createdBy: caller.id,
      trigger: dto.trigger ?? "manual",
    });

    const saved = await this.canvasSnapshotRepository.save(snapshot);

    await this.auditService.log({
      workflowId,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_SNAPSHOT_CREATED",
      elementId: saved.id,
      beforeState: null,
      afterState: { trigger: saved.trigger },
    });

    return saved;
  }

  async getSnapshots(
    workflowId: string,
    orgId: string,
  ): Promise<CanvasSnapshot[]> {
    const canvas = await this.getCanvas(workflowId, orgId);

    return this.canvasSnapshotRepository.find({
      where: { canvasId: canvas.id },
      order: { createdAt: "DESC" },
    });
  }

  async getSnapshot(
    snapshotId: string,
    orgId: string,
  ): Promise<CanvasSnapshot> {
    const snapshot = await this.canvasSnapshotRepository.findOne({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException("Snapshot not found");
    }

    await this.resolveWorkflowId(snapshot.canvasId, orgId); // org-scope check

    return snapshot;
  }

  // ─── Canvas Commit ────────────────────────────────────────────────

  async commitCanvas(
    workflowId: string,
    dto: CommitCanvasDto,
    caller: RequestUser,
  ): Promise<CanvasVersion> {
    const workflow = await this.findWorkflowInOrgOrThrow(
      workflowId,
      caller.orgId,
    );

    if (workflow.ownerId !== caller.id && caller.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only owner or admin can commit the canvas");
    }

    const canvas = await this.getCanvas(workflowId, caller.orgId);

    // Take a pre-commit snapshot
    const objects = await this.canvasObjectRepository.find({
      where: { canvasId: canvas.id },
      order: { createdAt: "ASC" },
    });

    const snapshotData = this.buildSnapshotData(objects);

    // Build elements_json from canvas objects
    const elementsJson = objects.map((obj) => ({
      id: obj.id,
      type: obj.type,
      elsa_type: obj.elsaType,
      label: obj.label,
      properties: obj.properties,
      position: { x: obj.positionX, y: obj.positionY },
      width: obj.width,
      height: obj.height,
      style: obj.style,
    }));

    // Create a new WorkflowVersion
    const newVersionNumber = workflow.currentVersion + 1;

    let savedSnapshot: CanvasSnapshot;
    let workflowVersionId: string;

    await this.dataSource.transaction(async (manager) => {
      const snapshotResult = await manager.insert(CanvasSnapshot, {
        canvasId: canvas.id,
        snapshotData,
        createdBy: caller.id,
        trigger: "pre-commit",
      });

      const snapshotId = snapshotResult.identifiers[0].id as string;

      const versionResult = await manager.insert(WorkflowVersion, {
        workflowId: workflow.id,
        versionNumber: newVersionNumber,
        elementsJson: { elements: elementsJson },
        elsaJson: null,
        confidenceScore: null,
        createdBy: caller.id,
      });

      workflowVersionId = versionResult.identifiers[0].id as string;

      await manager.update(Workflow, workflow.id, {
        currentVersion: newVersionNumber,
        updatedAt: new Date(),
      });

      await manager.insert(CanvasVersion, {
        canvasId: canvas.id,
        workflowVersionId,
        snapshotId,
        label: dto.label ?? null,
        type: "committed",
        createdBy: caller.id,
      });

      savedSnapshot = { id: snapshotId } as CanvasSnapshot;
    });

    // Fetch the CanvasVersion after the transaction commits
    const canvasVersion = await this.canvasVersionRepository.findOne({
      where: {
        canvasId: canvas.id,
        workflowVersionId,
      },
      order: { createdAt: "DESC" },
    });

    if (!canvasVersion) {
      throw new Error("Failed to create canvas version during commit");
    }

    const savedCanvasVersion = canvasVersion;

    await this.auditService.log({
      workflowId: workflow.id,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_COMMITTED",
      elementId: savedCanvasVersion.id,
      beforeState: null,
      afterState: {
        workflow_version_id: workflowVersionId,
        version_number: newVersionNumber,
        object_count: objects.length,
      },
    });

    this.realtime.broadcastCanvasCommitted(
      canvas.id,
      workflow.id,
      savedCanvasVersion,
      workflowVersionId,
      newVersionNumber,
    );

    return savedCanvasVersion;
  }

  async getVersions(
    workflowId: string,
    orgId: string,
  ): Promise<CanvasVersion[]> {
    const canvas = await this.getCanvas(workflowId, orgId);

    return this.canvasVersionRepository.find({
      where: { canvasId: canvas.id },
      order: { createdAt: "DESC" },
    });
  }

  async getVersion(versionId: string, orgId: string): Promise<CanvasVersion> {
    const version = await this.canvasVersionRepository.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException("Canvas version not found");
    }

    await this.resolveWorkflowId(version.canvasId, orgId); // org-scope check

    return version;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private async findWorkflowInOrgOrThrow(
    workflowId: string,
    orgId: string,
  ): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, orgId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }

    return workflow;
  }

  private async findObjectInOrgOrThrow(
    objectId: string,
    orgId: string,
  ): Promise<CanvasObject> {
    const obj = await this.canvasObjectRepository.findOne({
      where: { id: objectId },
    });

    if (!obj) {
      throw new NotFoundException("Canvas object not found");
    }

    // Org-scope: ensure the object's canvas belongs to this org
    await this.resolveWorkflowId(obj.canvasId, orgId);

    return obj;
  }

  private async findCanvasOrThrow(canvasId: string): Promise<Canvas> {
    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId },
    });
    if (!canvas) throw new NotFoundException("Canvas not found");
    return canvas;
  }

  private async lockCanvas(
    manager: EntityManager,
    canvasId: string,
  ): Promise<Canvas> {
    const canvas = await manager.findOne(Canvas, {
      where: { id: canvasId },
      lock: { mode: "pessimistic_write" },
    });
    if (!canvas) throw new NotFoundException("Canvas not found");
    return canvas;
  }

  private async appendOperationWithLockedCanvas(
    manager: EntityManager,
    canvas: Canvas,
    canvasObjectId: string | null,
    userId: string,
    opType: string,
    opPayload: Record<string, unknown>,
    versionVector?: Record<string, unknown>,
  ): Promise<CanvasOperation> {
    const clientRevision = Number(canvas.revision);
    const workflow = canvas.workspaceId
      ? await manager.findOne(Workflow, {
          where: { id: canvas.workflowId },
          select: { id: true, orgId: true },
        })
      : null;
    if (canvas.workspaceId && !workflow) {
      throw new NotFoundException("Canvas workflow not found");
    }
    const operation = manager.create(CanvasOperation, {
      canvasId: canvas.id,
      organizationId: workflow?.orgId ?? null,
      workspaceId: canvas.workspaceId,
      canvasObjectId,
      userId,
      opType,
      opPayload,
      versionVector: versionVector ?? null,
      sequenceNumber: clientRevision + 1,
      clientRevision: canvas.workspaceId ? clientRevision : null,
    });
    const saved = await manager.save(operation);
    canvas.revision = clientRevision + 1;
    await manager.save(canvas);
    return saved;
  }

  private async resolveWorkflowId(
    canvasId: string,
    orgId: string,
  ): Promise<string | null> {
    const row = await this.canvasRepository.query(
      `
        SELECT w.id, w.org_id
        FROM canvas c
        JOIN workflow w ON w.id = c.workflow_id
        WHERE c.id = $1
      `,
      [canvasId],
    );

    if (!row?.[0]) {
      throw new NotFoundException("Canvas not found");
    }

    if (row[0].org_id !== orgId) {
      throw new NotFoundException("Canvas not found");
    }

    return row[0].id as string;
  }

  private async requireCanvasMutationPermission(
    canvas: Canvas,
    caller: RequestUser,
  ): Promise<void> {
    if (canvas.workspaceId) {
      await this.workspacePermissions.requireEditor(
        caller.id,
        canvas.workspaceId,
        caller.orgId,
      );
      return;
    }

    const legacyMutationRoles: string[] = [
      UserRole.ADMIN,
      UserRole.PROCESS_OWNER,
      UserRole.BUSINESS_ANALYST,
    ];
    if (!legacyMutationRoles.includes(caller.role)) {
      throw new ForbiddenException("Canvas mutation access denied");
    }
  }

  private assertOperationPayloadBounded(payload: Record<string, unknown>): void {
    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
    if (sizeBytes > MAX_CANVAS_OPERATION_PAYLOAD_BYTES) {
      throw new BadRequestException(
        `Canvas operation payload exceeds ${MAX_CANVAS_OPERATION_PAYLOAD_BYTES} bytes`,
      );
    }
  }

  private buildSnapshotData(objects: CanvasObject[]): Record<string, unknown> {
    return {
      objects: objects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        elsa_type: obj.elsaType,
        label: obj.label,
        properties: obj.properties,
        position_x: obj.positionX,
        position_y: obj.positionY,
        width: obj.width,
        height: obj.height,
        style: obj.style,
        is_locked: obj.isLocked,
      })),
    };
  }
}
