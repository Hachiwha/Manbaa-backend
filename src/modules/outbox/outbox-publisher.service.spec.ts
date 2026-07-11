import { OutboxStatus } from "./entities/outbox-event.entity";
import { OutboxPublisherService } from "./outbox-publisher.service";

describe("OutboxPublisherService", () => {
  const event = {
    id: "e1",
    eventType: "workspace.ai.task.requested",
    payload: { eventId: "e1" },
    attemptCount: 0,
  };
  const update = jest.fn();
  const execute = jest.fn().mockResolvedValue(undefined);
  const whereInIds = jest.fn(() => ({ execute }));
  const set = jest.fn(() => ({ whereInIds }));
  const manager = {
    query: jest.fn().mockResolvedValue([{ id: "e1" }]),
    createQueryBuilder: () => ({ update: () => ({ set }) }),
    findBy: jest.fn().mockResolvedValue([event]),
  };
  const db = {
    transaction: (callback: (value: typeof manager) => unknown) =>
      callback(manager),
    getRepository: () => ({ update }),
  };
  const nats = { publish: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    manager.query.mockResolvedValue([{ id: "e1" }]);
    manager.findBy.mockResolvedValue([event]);
    nats.publish.mockResolvedValue(undefined);
  });

  it("marks published only after NATS acknowledgement with the outbox ID", async () => {
    const service = new OutboxPublisherService(db as never, nats as never);

    await expect(service.publishBatch()).resolves.toBe(1);
    expect(nats.publish).toHaveBeenCalledWith(
      event.eventType,
      event.payload,
      event.id,
    );
    expect(update).toHaveBeenCalledWith(
      event.id,
      expect.objectContaining({ status: OutboxStatus.PUBLISHED }),
    );
  });

  it("schedules retry after failure", async () => {
    nats.publish.mockRejectedValue(new Error("broker unavailable"));
    const service = new OutboxPublisherService(db as never, nats as never);

    await service.publishBatch();
    expect(update).toHaveBeenCalledWith(
      event.id,
      expect.objectContaining({
        status: OutboxStatus.PENDING,
        attemptCount: 1,
        availableAt: expect.any(Date),
      }),
    );
  });

  it("reclaims an expired publishing lease after process interruption", async () => {
    const service = new OutboxPublisherService(db as never, nats as never);

    await service.publishBatch();
    expect(manager.query.mock.calls[0][0]).toContain("status = 'publishing'");
    expect(set).toHaveBeenCalledWith({
      status: OutboxStatus.PUBLISHING,
      availableAt: expect.any(Date),
    });
  });
});
