import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CanvasAiPreviewClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const CANVAS_AI_PREVIEW_CLOCK = Symbol('CANVAS_AI_PREVIEW_CLOCK');

export interface CanvasAiPreviewTrigger {
  canvasId: string;
  revision: number;
  reason: 'debounce' | 'max_debounce' | 'explicit';
}

export type CanvasAiPreviewTriggerHandler = (
  trigger: CanvasAiPreviewTrigger,
) => void | Promise<void>;

interface PendingPreview {
  timer: unknown;
  firstEditAt: number;
  dueAt: number;
  revision: number;
  handler: CanvasAiPreviewTriggerHandler;
}

const systemClock: CanvasAiPreviewClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/**
 * Coalesces automatic preview requests without moving live canvas operations
 * onto NATS. The caller supplies the eventual snapshot trigger; this service
 * only owns timing and guarantees one pending timer per canvas.
 */
@Injectable()
export class CanvasAiPreviewCoordinator {
  private readonly logger = new Logger(CanvasAiPreviewCoordinator.name);
  private readonly pending = new Map<string, PendingPreview>();
  private readonly debounceMs: number;
  private readonly maxDebounceMs: number;
  private readonly autoPreviewEnabled: boolean;
  private readonly clock: CanvasAiPreviewClock;

  constructor(
    configService: ConfigService,
    @Optional()
    @Inject(CANVAS_AI_PREVIEW_CLOCK)
    clock?: CanvasAiPreviewClock,
  ) {
    this.debounceMs = configService.get<number>('canvasAi.debounceMs', 3_000);
    this.maxDebounceMs = configService.get<number>(
      'canvasAi.maxDebounceMs',
      15_000,
    );
    this.autoPreviewEnabled = configService.get<boolean>(
      'canvasAi.autoPreviewEnabled',
      false,
    );
    this.clock = clock ?? systemClock;

    if (this.maxDebounceMs < this.debounceMs) {
      throw new RangeError(
        'CANVAS_AI_MAX_DEBOUNCE_MS must be greater than or equal to CANVAS_AI_DEBOUNCE_MS',
      );
    }
  }

  scheduleEdit(
    canvasId: string,
    revision: number,
    handler: CanvasAiPreviewTriggerHandler,
  ): { scheduled: boolean; dueAt?: number } {
    if (!this.autoPreviewEnabled) return { scheduled: false };

    const now = this.clock.now();
    const existing = this.pending.get(canvasId);
    if (existing) this.clock.clearTimeout(existing.timer);

    const firstEditAt = existing?.firstEditAt ?? now;
    const maxDueAt = firstEditAt + this.maxDebounceMs;
    const dueAt = Math.min(now + this.debounceMs, maxDueAt);
    const reason = dueAt === maxDueAt ? 'max_debounce' : 'debounce';

    let pending: PendingPreview;
    const timer = this.clock.setTimeout(() => {
      if (this.pending.get(canvasId) !== pending) return;
      this.pending.delete(canvasId);
      void this.invoke(handler, { canvasId, revision, reason });
    }, Math.max(0, dueAt - now));

    pending = { timer, firstEditAt, dueAt, revision, handler };
    this.pending.set(canvasId, pending);
    return { scheduled: true, dueAt };
  }

  async triggerExplicit(
    canvasId: string,
    revision: number,
    handler: CanvasAiPreviewTriggerHandler,
  ): Promise<void> {
    this.cancel(canvasId);
    await handler({ canvasId, revision, reason: 'explicit' });
  }

  cancel(canvasId: string): boolean {
    const existing = this.pending.get(canvasId);
    if (!existing) return false;
    this.clock.clearTimeout(existing.timer);
    this.pending.delete(canvasId);
    return true;
  }

  getPending(canvasId: string):
    | { revision: number; firstEditAt: number; dueAt: number }
    | undefined {
    const pending = this.pending.get(canvasId);
    if (!pending) return undefined;
    return {
      revision: pending.revision,
      firstEditAt: pending.firstEditAt,
      dueAt: pending.dueAt,
    };
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  private async invoke(
    handler: CanvasAiPreviewTriggerHandler,
    trigger: CanvasAiPreviewTrigger,
  ): Promise<void> {
    try {
      await handler(trigger);
    } catch (error) {
      this.logger.error(
        `Canvas AI preview trigger failed for ${trigger.canvasId} at revision ${trigger.revision}: ${(error as Error).message}`,
      );
    }
  }
}
