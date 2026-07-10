import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { ActorType, UserRole } from "../../../database/enums";
import { AuditService } from "../../audit/audit.service";
import { Workflow } from "../../workflows/entities/workflow.entity";
import { WorkflowVersion } from "../../workflows/entities/workflow-version.entity";
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
} from "../dto/canvas.dto";

type RequestUser = {
  id: string;
  orgId: string;
  role: string;
};

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

    const obj = this.canvasObjectRepository.create({
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

    const saved = await this.canvasObjectRepository.save(obj);

    await this.appendOperation(
      canvas.id,
      saved.id,
      caller.id,
      "object_create",
      {
        type: saved.type,
        elsa_type: saved.elsaType,
        label: saved.label,
        position_x: saved.positionX,
        position_y: saved.positionY,
      },
    );

    await this.auditService.log({
      workflowId,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_CREATED",
      elementId: saved.id,
      beforeState: null,
      afterState: { type: saved.type, label: saved.label },
    });

    return saved;
  }

  async updateObject(
    objectId: string,
    dto: UpdateCanvasObjectDto,
    caller: RequestUser,
  ): Promise<CanvasObject> {
    const obj = await this.findObjectInOrgOrThrow(objectId, caller.orgId);

    if (obj.isLocked && caller.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Cannot modify a locked object");
    }

    const beforeState = {
      label: obj.label,
      position_x: obj.positionX,
      position_y: obj.positionY,
      width: obj.width,
      height: obj.height,
    };

    if (dto.label !== undefined) obj.label = dto.label;
    if (dto.elsa_type !== undefined) obj.elsaType = dto.elsa_type;
    if (dto.properties !== undefined) obj.properties = dto.properties;
    if (dto.position_x !== undefined) obj.positionX = dto.position_x;
    if (dto.position_y !== undefined) obj.positionY = dto.position_y;
    if (dto.width !== undefined) obj.width = dto.width;
    if (dto.height !== undefined) obj.height = dto.height;
    if (dto.style !== undefined) obj.style = dto.style;

    const saved = await this.canvasObjectRepository.save(obj);

    await this.appendOperation(
      obj.canvasId,
      saved.id,
      caller.id,
      "object_update",
      {
        label: saved.label,
        position_x: saved.positionX,
        position_y: saved.positionY,
        width: saved.width,
        height: saved.height,
      },
    );

    await this.auditService.log({
      workflowId:
        (await this.resolveWorkflowId(obj.canvasId, caller.orgId)) ??
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

    return saved;
  }

  async moveObject(
    objectId: string,
    dto: MoveCanvasObjectDto,
    caller: RequestUser,
  ): Promise<CanvasObject> {
    const obj = await this.findObjectInOrgOrThrow(objectId, caller.orgId);

    if (obj.isLocked && caller.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Cannot move a locked object");
    }

    const beforeState = {
      position_x: obj.positionX,
      position_y: obj.positionY,
    };

    obj.positionX = dto.position_x;
    obj.positionY = dto.position_y;

    const saved = await this.canvasObjectRepository.save(obj);

    await this.appendOperation(
      obj.canvasId,
      saved.id,
      caller.id,
      "object_move",
      {
        position_x: saved.positionX,
        position_y: saved.positionY,
      },
    );

    await this.auditService.log({
      workflowId:
        (await this.resolveWorkflowId(obj.canvasId, caller.orgId)) ??
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

    return saved;
  }

  async deleteObject(
    objectId: string,
    caller: RequestUser,
  ): Promise<{ deleted: boolean }> {
    const obj = await this.findObjectInOrgOrThrow(objectId, caller.orgId);

    if (obj.isLocked && caller.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Cannot delete a locked object");
    }

    await this.appendOperation(
      obj.canvasId,
      objectId,
      caller.id,
      "object_delete",
      {
        type: obj.type,
        label: obj.label,
      },
    );

    await this.canvasObjectRepository.remove(obj);

    await this.auditService.log({
      workflowId:
        (await this.resolveWorkflowId(obj.canvasId, caller.orgId)) ??
        undefined,
      actorId: caller.id,
      actorType: ActorType.USER,
      eventType: "CANVAS_OBJECT_DELETED",
      elementId: objectId,
      beforeState: { type: obj.type, label: obj.label },
      afterState: null,
    });

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
    const nextSeq = await this.nextSequenceNumber(canvasId);

    const op = this.canvasOperationRepository.create({
      canvasId,
      canvasObjectId,
      userId,
      opType,
      opPayload,
      versionVector: versionVector ?? null,
      sequenceNumber: nextSeq,
    });

    return this.canvasOperationRepository.save(op);
  }

  async createOperation(
    workflowId: string,
    dto: CreateCanvasOperationDto,
    caller: RequestUser,
  ): Promise<CanvasOperation> {
    const canvas = await this.getOrCreateCanvas(workflowId, caller.orgId);

    const op = await this.appendOperation(
      canvas.id,
      dto.canvas_object_id ?? null,
      caller.id,
      dto.op_type,
      dto.op_payload,
      dto.version_vector,
    );

    return op;
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

  private async nextSequenceNumber(canvasId: string): Promise<number> {
    const result = await this.canvasOperationRepository
      .createQueryBuilder("op")
      .select("COALESCE(MAX(op.sequence_number), 0)", "maxSeq")
      .where("op.canvas_id = :canvasId", { canvasId })
      .getRawOne<{ maxSeq: string }>();

    return Number(result?.maxSeq ?? 0) + 1;
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
