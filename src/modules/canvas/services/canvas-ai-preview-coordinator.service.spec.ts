import { ConfigService } from '@nestjs/config';

import {
  CanvasAiPreviewClock,
  CanvasAiPreviewCoordinator,
} from './canvas-ai-preview-coordinator.service';

class FakeClock implements CanvasAiPreviewClock {
  private current = 0;
  private sequence = 0;
  private readonly timers = new Map<
    number,
    { dueAt: number; callback: () => void }
  >();

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = ++this.sequence;
    this.timers.set(id, { dueAt: this.current + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advanceBy(milliseconds: number): void {
    const target = this.current + milliseconds;
    for (;;) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.current = timer.dueAt;
      timer.callback();
    }
    this.current = target;
  }
}

describe('CanvasAiPreviewCoordinator', () => {
  function setup(enabled = true) {
    const values: Record<string, unknown> = {
      'canvasAi.autoPreviewEnabled': enabled,
      'canvasAi.debounceMs': 100,
      'canvasAi.maxDebounceMs': 250,
    };
    const config = {
      get: jest.fn((key: string, fallback: unknown) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const clock = new FakeClock();
    return {
      clock,
      coordinator: new CanvasAiPreviewCoordinator(config, clock),
    };
  }

  it('coalesces edits and resets the normal debounce', () => {
    const { coordinator, clock } = setup();
    const handler = jest.fn();

    coordinator.scheduleEdit('canvas-1', 1, handler);
    clock.advanceBy(60);
    coordinator.scheduleEdit('canvas-1', 2, handler);
    clock.advanceBy(99);
    expect(handler).not.toHaveBeenCalled();

    clock.advanceBy(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      canvasId: 'canvas-1',
      revision: 2,
      reason: 'debounce',
    });
  });

  it('caps repeated resets at the maximum debounce', () => {
    const { coordinator, clock } = setup();
    const handler = jest.fn();

    coordinator.scheduleEdit('canvas-1', 1, handler);
    clock.advanceBy(80);
    coordinator.scheduleEdit('canvas-1', 2, handler);
    clock.advanceBy(80);
    coordinator.scheduleEdit('canvas-1', 3, handler);
    clock.advanceBy(80);
    coordinator.scheduleEdit('canvas-1', 4, handler);
    clock.advanceBy(9);
    expect(handler).not.toHaveBeenCalled();

    clock.advanceBy(1);
    expect(handler).toHaveBeenCalledWith({
      canvasId: 'canvas-1',
      revision: 4,
      reason: 'max_debounce',
    });
  });

  it('lets an explicit request cancel and bypass a pending debounce', async () => {
    const { coordinator, clock } = setup();
    const automatic = jest.fn();
    const explicit = jest.fn();

    coordinator.scheduleEdit('canvas-1', 1, automatic);
    await coordinator.triggerExplicit('canvas-1', 2, explicit);
    clock.advanceBy(500);

    expect(automatic).not.toHaveBeenCalled();
    expect(explicit).toHaveBeenCalledWith({
      canvasId: 'canvas-1',
      revision: 2,
      reason: 'explicit',
    });
    expect(coordinator.getPendingCount()).toBe(0);
  });

  it('does not schedule automatic work when disabled', () => {
    const { coordinator, clock } = setup(false);
    const handler = jest.fn();

    expect(coordinator.scheduleEdit('canvas-1', 1, handler)).toEqual({
      scheduled: false,
    });
    clock.advanceBy(500);
    expect(handler).not.toHaveBeenCalled();
  });
});
