import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { EntityManager } from "typeorm";

import { OutboxEvent, OutboxStatus } from "./entities/outbox-event.entity";

type OutboxCreateInput = Pick<
  OutboxEvent,
  "aggregateType" | "aggregateId" | "eventType" | "payload" | "correlationId"
>;

export interface OutboxCreateOptions {
  eventId?: string;
  eventIdField?: "eventId" | "event_id";
}

@Injectable()
export class OutboxService {
  create(
    manager: EntityManager,
    input: OutboxCreateInput,
    options: OutboxCreateOptions = {},
  ): Promise<OutboxEvent> {
    const eventIdField = options.eventIdField ?? "eventId";
    const existingEventId = input.payload[eventIdField];
    if (existingEventId !== undefined && typeof existingEventId !== "string") {
      throw new TypeError(`Outbox payload ${eventIdField} must be a string`);
    }
    const id: string =
      options.eventId ??
      (typeof existingEventId === "string" ? existingEventId : randomUUID());
    if (existingEventId !== undefined && existingEventId !== id) {
      throw new TypeError(
        "Outbox event ID conflicts with the payload event ID",
      );
    }
    const alternateField = eventIdField === "eventId" ? "event_id" : "eventId";
    const alternateId = input.payload[alternateField];
    if (alternateId !== undefined && alternateId !== id) {
      throw new TypeError(
        "Outbox payload contains two different logical event IDs",
      );
    }

    return manager.save(
      manager.create(OutboxEvent, {
        id,
        ...input,
        payload: { ...input.payload, [eventIdField]: id },
        status: OutboxStatus.PENDING,
        attemptCount: 0,
        availableAt: new Date(),
        publishedAt: null,
        lastError: null,
      }),
    );
  }
}
