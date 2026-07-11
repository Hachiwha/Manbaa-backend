import { OutboxService } from "./outbox.service";

describe("OutboxService", () => {
  const input = {
    aggregateType: "source",
    aggregateId: "aggregate-id",
    eventType: "workspace.source.process.requested",
    payload: { value: true },
    correlationId: "correlation-id",
  };

  function manager() {
    return {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => value),
    };
  }

  it("preserves eventId injection for existing callers", async () => {
    const entityManager = manager();
    const saved = await new OutboxService().create(
      entityManager as never,
      input,
    );

    expect(saved.payload.eventId).toBe(saved.id);
    expect(saved.payload).not.toHaveProperty("event_id");
  });

  it("can use an explicit id and inject canonical event_id", async () => {
    const entityManager = manager();
    const eventId = "11111111-1111-4111-8111-111111111111";
    const saved = await new OutboxService().create(
      entityManager as never,
      input,
      {
        eventId,
        eventIdField: "event_id",
      },
    );

    expect(saved.id).toBe(eventId);
    expect(saved.payload).toEqual({ value: true, event_id: eventId });
    expect(saved.payload).not.toHaveProperty("eventId");
  });

  it("reuses an envelope event ID and rejects conflicting logical IDs", async () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const entityManager = manager();
    const saved = await new OutboxService().create(entityManager as never, {
      ...input,
      payload: { eventId },
    });
    expect(saved.id).toBe(eventId);

    expect(() =>
      new OutboxService().create(
        manager() as never,
        { ...input, payload: { event_id: eventId } },
        {
          eventId: "99999999-9999-4999-8999-999999999999",
          eventIdField: "event_id",
        },
      ),
    ).toThrow("conflicts");
  });
});
