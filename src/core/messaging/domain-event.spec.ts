import { assertDomainEvent, createDomainEvent } from './domain-event';

describe('DomainEvent', () => {
  const base = {
    eventType: 'workspace.ai.task.requested',
    organizationId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    userId: '33333333-3333-4333-8333-333333333333',
    correlationId: '44444444-4444-4444-8444-444444444444',
    payload: { taskId: '55555555-5555-4555-8555-555555555555' },
  };

  it('creates a versioned event with stable caller context', () => {
    const event = createDomainEvent(base);
    expect(event).toEqual(expect.objectContaining({ ...base, schemaVersion: 1 }));
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    expect(() => assertDomainEvent(event)).not.toThrow();
  });

  it('rejects malformed envelopes before publication', () => {
    expect(() => assertDomainEvent({ ...createDomainEvent(base), payload: [] })).toThrow(
      'payload must be an object',
    );
  });
});
