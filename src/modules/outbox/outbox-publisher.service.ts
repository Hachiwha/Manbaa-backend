import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";

import { NatsClientService } from "../../infra/nats/nats.client";
import { OutboxEvent, OutboxStatus } from "./entities/outbox-event.entity";

const PUBLISH_LEASE_MS = 60_000;

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly db: DataSource,
    private readonly nats: NatsClientService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.publishBatch(), 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async publishBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const events = await this.claim();
      for (const event of events) await this.publishOne(event);
      return events.length;
    } finally {
      this.running = false;
    }
  }

  async reprocessFailed(id: string): Promise<void> {
    await this.db.getRepository(OutboxEvent).update(
      { id, status: OutboxStatus.FAILED },
      {
        status: OutboxStatus.PENDING,
        attemptCount: 0,
        availableAt: new Date(),
        lastError: null,
      },
    );
  }

  private claim(): Promise<OutboxEvent[]> {
    return this.db.transaction(async (manager) => {
      const rows: { id: string }[] = await manager.query(`
        SELECT id
        FROM outbox_event
        WHERE (
          (status IN ('pending','failed') AND available_at <= now())
          OR (status = 'publishing' AND available_at <= now())
        )
          AND attempt_count < 8
        ORDER BY created_at
        LIMIT 20
        FOR UPDATE SKIP LOCKED
      `);
      if (!rows.length) return [];

      const ids = rows.map((row) => row.id);
      await manager
        .createQueryBuilder()
        .update(OutboxEvent)
        .set({
          status: OutboxStatus.PUBLISHING,
          availableAt: new Date(Date.now() + PUBLISH_LEASE_MS),
        })
        .whereInIds(ids)
        .execute();
      return manager.findBy(OutboxEvent, { id: In(ids) });
    });
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    try {
      await this.nats.publish(event.eventType, event.payload, event.id);
      await this.db.getRepository(OutboxEvent).update(event.id, {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const attempts = event.attemptCount + 1;
      const message =
        error instanceof Error ? error.message : "Unknown publication error";
      await this.db.getRepository(OutboxEvent).update(event.id, {
        status: attempts >= 8 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        attemptCount: attempts,
        availableAt: new Date(
          Date.now() + Math.min(300_000, 1000 * 2 ** attempts),
        ),
        lastError: message.slice(0, 1000),
      });
      this.logger.warn(
        `Outbox publish failed id=${event.id} attempt=${attempts}`,
      );
    }
  }
}
