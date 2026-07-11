import { AiTaskEventsService } from './ai-task-events.service';
import { AiTask, JobStatus } from './entities/ai-task.entity';

describe('AiTaskEventsService stale preview lineage', () => {
  it('marks a superseded task stale and never exposes or settles its late result', async () => {
    const task = Object.assign(new AiTask(), {
      id: '10000000-0000-4000-8000-000000000008',
      organizationId: '10000000-0000-4000-8000-000000000002',
      workspaceId: '10000000-0000-4000-8000-000000000003',
      userId: '10000000-0000-4000-8000-000000000007',
      correlationId: '10000000-0000-4000-8000-000000000005',
      status: JobStatus.SUPERSEDED,
      snapshotId: '10000000-0000-4000-8000-000000000010',
      canvasRevision: 148,
      resultPayload: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
    });
    const tasks = {
      findOne: jest.fn().mockResolvedValue(task),
      save: jest.fn(async (value) => value),
    };
    const manager = { save: jest.fn() };
    const db = { transaction: jest.fn(async (callback) => callback(manager)) };
    const usage = { commitUsage: jest.fn(), releaseUsage: jest.fn() };
    const notifications = { createNotification: jest.fn() };
    const audit = { createAuditLog: jest.fn() };
    const realtime = {
      emitToRoom: jest.fn(),
      emitToUser: jest.fn(),
    };
    const internalTokens = {
      validate: jest.fn().mockResolvedValue({
        organizationId: task.organizationId,
        workspaceId: task.workspaceId,
        taskId: task.id,
        allowedActions: ['ai.task.completed'],
      }),
    };
    const service = new AiTaskEventsService(
      tasks as never,
      db as never,
      {} as never,
      usage as never,
      notifications as never,
      audit as never,
      realtime as never,
      internalTokens as never,
    );

    await service.handle('completed', {
      schemaVersion: 1,
      eventId: '10000000-0000-4000-8000-000000000020',
      eventType: 'workspace.ai.task.completed',
      organizationId: task.organizationId,
      workspaceId: task.workspaceId,
      userId: task.userId,
      correlationId: task.correlationId,
      timestamp: '2026-07-11T12:01:00.000Z',
      payload: {
        taskId: task.id,
        internalToken: 'signed-worker-token',
        result: { unsafe_auto_apply: true },
        actualUsage: 99,
      },
    });

    expect(task.status).toBe(JobStatus.STALE);
    expect(task.resultPayload).toBeNull();
    expect(task.errorCode).toBe('STALE_RESULT');
    expect(usage.commitUsage).not.toHaveBeenCalled();
    expect(usage.releaseUsage).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    const emittedPayloads = realtime.emitToRoom.mock.calls.map((call) => call[2]);
    expect(emittedPayloads).not.toContainEqual(
      expect.objectContaining({ result: expect.anything() }),
    );
    expect(realtime.emitToRoom).toHaveBeenCalledWith(
      `ai-task:${task.id}`,
      'ai.task.stale',
      expect.objectContaining({ currentStep: 'stale_result_ignored' }),
    );
  });
});
