import { WS_EVENTS, WS_ROOMS } from '../../realtime/constants/ws-events.constants';
import { CanvasRealtimeService } from './canvas-realtime.service';

describe('CanvasRealtimeService Phase 04 events', () => {
  const gateway = {
    hasListeners: jest.fn().mockReturnValue(true),
    emitToRoom: jest.fn(),
  };
  const service = new CanvasRealtimeService(gateway as never);

  beforeEach(() => jest.clearAllMocks());

  it('emits snapshot and queue events only to the scoped canvas room', () => {
    const scope = {
      organization_id: '22222222-2222-4222-8222-222222222222',
      workspace_id: '33333333-3333-4333-8333-333333333333',
      canvas_id: '44444444-4444-4444-8444-444444444444',
    };

    service.broadcastSnapshotCreated({
      ...scope,
      task_id: '55555555-5555-4555-8555-555555555555',
      snapshot_id: '66666666-6666-4666-8666-666666666666',
      snapshot_version: 3,
      canvas_revision: 12,
      status: 'pending',
      created_at: '2026-07-11T12:00:00.000Z',
    });
    service.broadcastAiPreviewQueued({
      ...scope,
      task_id: '55555555-5555-4555-8555-555555555555',
      snapshot_id: '66666666-6666-4666-8666-666666666666',
      snapshot_version: 3,
      canvas_revision: 12,
      status: 'queued',
    });

    expect(gateway.emitToRoom).toHaveBeenNthCalledWith(
      1,
      WS_ROOMS.canvas(scope.canvas_id),
      WS_EVENTS.CANVAS_SNAPSHOT_CREATED,
      expect.objectContaining(scope),
    );
    expect(gateway.emitToRoom).toHaveBeenNthCalledWith(
      2,
      WS_ROOMS.canvas(scope.canvas_id),
      WS_EVENTS.CANVAS_AI_PREVIEW_QUEUED,
      expect.objectContaining(scope),
    );
    expect(gateway.emitToRoom).toHaveBeenCalledTimes(2);
  });

  it('does not expose storage references in supersession events', () => {
    service.broadcastAiPreviewSuperseded({
      organization_id: '22222222-2222-4222-8222-222222222222',
      workspace_id: '33333333-3333-4333-8333-333333333333',
      canvas_id: '44444444-4444-4444-8444-444444444444',
      superseded_task_id: '55555555-5555-4555-8555-555555555555',
      superseded_snapshot_id: '66666666-6666-4666-8666-666666666666',
      replacement_task_id: '77777777-7777-4777-8777-777777777777',
      replacement_snapshot_id: '88888888-8888-4888-8888-888888888888',
      canvas_revision: 13,
    });

    const payload = gateway.emitToRoom.mock.calls[0][2];
    expect(payload).not.toHaveProperty('storage_key');
    expect(payload).not.toHaveProperty('preview_key');
  });
});
