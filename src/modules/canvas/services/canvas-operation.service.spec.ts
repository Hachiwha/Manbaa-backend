import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { Canvas } from '../entities/canvas.entity';
import { CanvasOperation } from '../entities/canvas-operation.entity';
import {
  MAX_CANVAS_OPERATION_PAYLOAD_BYTES,
  CreateCanvasOperationDto,
} from '../dto/canvas.dto';
import { CanvasService } from './canvas.service';

describe('CanvasService canonical operations', () => {
  const organizationId = '22222222-2222-4222-8222-222222222222';
  const workspaceId = '33333333-3333-4333-8333-333333333333';
  const workflowId = '44444444-4444-4444-8444-444444444444';
  const canvasId = '55555555-5555-4555-8555-555555555555';
  const userId = '66666666-6666-4666-8666-666666666666';
  const operationId = '77777777-7777-4777-8777-777777777777';

  const dto: CreateCanvasOperationDto = {
    operation_id: operationId,
    client_revision: 5,
    op_type: 'object_move',
    op_payload: { x: 120, y: 80 },
  };

  function setup(existingOperation: CanvasOperation | null = null) {
    const canvas = Object.assign(new Canvas(), {
      id: canvasId,
      workflowId,
      workspaceId,
      revision: 5,
    });
    const canvasRepository = {
      findOne: jest.fn().mockResolvedValue(canvas),
    };
    const workflowRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: workflowId,
        orgId: organizationId,
      }),
    };
    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Canvas) return canvas;
        if (entity === CanvasOperation) return existingOperation;
        return null;
      }),
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn((entity, value) => Object.assign(new entity(), value)),
      save: jest.fn(async (value) => {
        if (value instanceof CanvasOperation) {
          value.createdAt = new Date('2026-07-11T12:00:00.000Z');
        }
        return value;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const realtime = {
      broadcastOperationAccepted: jest.fn(),
      broadcastOperationRejected: jest.fn(),
    };
    const permissions = { requireEditor: jest.fn().mockResolvedValue({}) };
    const service = new CanvasService(
      canvasRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workflowRepository as never,
      {} as never,
      dataSource as never,
      {} as never,
      realtime as never,
      permissions as never,
    );
    return {
      canvas,
      manager,
      dataSource,
      realtime,
      permissions,
      service,
    };
  }

  it('persists an operation idempotency ID and advances the locked canvas revision', async () => {
    const dependencies = setup();

    const operation = await dependencies.service.createOperation(
      workflowId,
      dto,
      { id: userId, orgId: organizationId, role: 'viewer' },
    );

    expect(dependencies.permissions.requireEditor).toHaveBeenCalledWith(
      userId,
      workspaceId,
      organizationId,
    );
    expect(operation).toEqual(
      expect.objectContaining({
        id: operationId,
        canvasId,
        userId,
        sequenceNumber: 6,
      }),
    );
    expect(dependencies.canvas.revision).toBe(6);
    expect(dependencies.realtime.broadcastOperationAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: organizationId,
        workspace_id: workspaceId,
        canvas_id: canvasId,
        operation_id: operationId,
        canvas_revision: 6,
      }),
    );
  });

  it('returns the original operation for an exact idempotent replay', async () => {
    const existing = Object.assign(new CanvasOperation(), {
      id: operationId,
      canvasId,
      organizationId,
      workspaceId,
      canvasObjectId: null,
      userId,
      opType: dto.op_type,
      opPayload: dto.op_payload,
      versionVector: null,
      sequenceNumber: 6,
      clientRevision: 5,
      createdAt: new Date('2026-07-11T12:00:00.000Z'),
    });
    const dependencies = setup(existing);
    dependencies.canvas.revision = 9;

    await expect(
      dependencies.service.createOperation(workflowId, dto, {
        id: userId,
        orgId: organizationId,
        role: 'viewer',
      }),
    ).resolves.toBe(existing);
    expect(dependencies.manager.save).not.toHaveBeenCalled();
    expect(
      dependencies.realtime.broadcastOperationAccepted,
    ).not.toHaveBeenCalled();
  });

  it('rejects a stale client revision and emits a scoped rejection', async () => {
    const dependencies = setup();
    dependencies.canvas.revision = 7;

    await expect(
      dependencies.service.createOperation(workflowId, dto, {
        id: userId,
        orgId: organizationId,
        role: 'viewer',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(dependencies.manager.save).not.toHaveBeenCalled();
    expect(dependencies.realtime.broadcastOperationRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        client_revision: 5,
        current_revision: 7,
        code: 'CANVAS_REVISION_CONFLICT',
      }),
    );
  });

  it('denies mutation when active workspace editor authorization fails', async () => {
    const dependencies = setup();
    dependencies.permissions.requireEditor.mockRejectedValue(
      new ForbiddenException('Workspace access denied'),
    );

    await expect(
      dependencies.service.createOperation(workflowId, dto, {
        id: userId,
        orgId: organizationId,
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects an operation payload above the byte limit before persistence', async () => {
    const dependencies = setup();

    await expect(
      dependencies.service.createOperation(
        workflowId,
        {
          ...dto,
          op_payload: {
            value: 'x'.repeat(MAX_CANVAS_OPERATION_PAYLOAD_BYTES),
          },
        },
        { id: userId, orgId: organizationId, role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });
});
