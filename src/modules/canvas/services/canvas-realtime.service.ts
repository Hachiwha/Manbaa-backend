import { Injectable, Logger } from "@nestjs/common";

import { CanvasObject } from "../entities/canvas-object.entity";
import { CanvasVersion } from "../entities/canvas-version.entity";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { WS_EVENTS, WS_ROOMS } from "../../realtime/constants/ws-events.constants";
import {
  CanvasObjectCreatedPayload,
  CanvasObjectUpdatedPayload,
  CanvasObjectMovedPayload,
  CanvasObjectDeletedPayload,
  CanvasCommittedPayload,
  CanvasCursorPayload,
  CanvasPresencePayload,
  CanvasOperationAcceptedPayload,
  CanvasOperationRejectedPayload,
  CanvasSnapshotCreatedPayload,
  CanvasAiPreviewQueuedPayload,
  CanvasAiPreviewSupersededPayload,
} from "../../realtime/interfaces/ws-payloads.interface";

const CURSOR_THROTTLE_MS = 50;

interface CursorState {
  positionX: number;
  positionY: number;
  selectedObjectIds: string[];
  lastEmittedAt: number;
}

/**
 * Ephemeral real-time broadcasting for the Canvas module.
 *
 * All state in this service is in-memory and intentionally not persisted:
 * cursor positions and presence counts are transient by design.
 * Canvas object mutations are broadcast as events but the source of
 * truth remains in PostgreSQL via CanvasService.
 */
@Injectable()
export class CanvasRealtimeService {
  private readonly logger = new Logger(CanvasRealtimeService.name);

  /** userId → CursorState — ephemeral, cleared on disconnect */
  private readonly cursors = new Map<string, CursorState>();

  /** canvasId → Set<userId> — ephemeral presence tracking */
  private readonly presence = new Map<string, Set<string>>();

  constructor(private readonly gateway: RealtimeGateway) {}

  // ─── Object Broadcasting ──────────────────────────────────────────

  broadcastObjectCreated(
    canvasId: string,
    workflowId: string,
    obj: CanvasObject,
  ): void {
    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_OBJECT_CREATED, {
      canvas_id: canvasId,
      workflow_id: workflowId,
      object_id: obj.id,
      type: obj.type,
      label: obj.label,
      position_x: obj.positionX,
      position_y: obj.positionY,
    } satisfies CanvasObjectCreatedPayload);
  }

  broadcastObjectUpdated(
    canvasId: string,
    workflowId: string,
    obj: CanvasObject,
  ): void {
    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_OBJECT_UPDATED, {
      canvas_id: canvasId,
      workflow_id: workflowId,
      object_id: obj.id,
      label: obj.label,
      position_x: obj.positionX,
      position_y: obj.positionY,
      width: obj.width,
      height: obj.height,
    } satisfies CanvasObjectUpdatedPayload);
  }

  broadcastObjectMoved(
    canvasId: string,
    workflowId: string,
    obj: CanvasObject,
  ): void {
    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_OBJECT_MOVED, {
      canvas_id: canvasId,
      workflow_id: workflowId,
      object_id: obj.id,
      position_x: obj.positionX,
      position_y: obj.positionY,
    } satisfies CanvasObjectMovedPayload);
  }

  broadcastObjectDeleted(
    canvasId: string,
    workflowId: string,
    objectId: string,
  ): void {
    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_OBJECT_DELETED, {
      canvas_id: canvasId,
      workflow_id: workflowId,
      object_id: objectId,
    } satisfies CanvasObjectDeletedPayload);
  }

  broadcastCanvasCommitted(
    canvasId: string,
    workflowId: string,
    canvasVersion: CanvasVersion,
    workflowVersionId: string,
    versionNumber: number,
  ): void {
    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_COMMITTED, {
      canvas_id: canvasId,
      workflow_id: workflowId,
      version_id: canvasVersion.id,
      workflow_version_id: workflowVersionId,
      version_number: versionNumber,
    } satisfies CanvasCommittedPayload);
  }

  broadcastOperationAccepted(payload: CanvasOperationAcceptedPayload): void {
    this.emitCanvasEvent(
      payload.canvas_id,
      WS_EVENTS.CANVAS_OPERATION_ACCEPTED,
      payload,
    );
  }

  broadcastOperationRejected(payload: CanvasOperationRejectedPayload): void {
    this.emitCanvasEvent(
      payload.canvas_id,
      WS_EVENTS.CANVAS_OPERATION_REJECTED,
      payload,
    );
  }

  broadcastSnapshotCreated(payload: CanvasSnapshotCreatedPayload): void {
    this.emitCanvasEvent(
      payload.canvas_id,
      WS_EVENTS.CANVAS_SNAPSHOT_CREATED,
      payload,
    );
  }

  broadcastAiPreviewQueued(payload: CanvasAiPreviewQueuedPayload): void {
    this.emitCanvasEvent(
      payload.canvas_id,
      WS_EVENTS.CANVAS_AI_PREVIEW_QUEUED,
      payload,
    );
  }

  broadcastAiPreviewSuperseded(
    payload: CanvasAiPreviewSupersededPayload,
  ): void {
    this.emitCanvasEvent(
      payload.canvas_id,
      WS_EVENTS.CANVAS_AI_PREVIEW_SUPERSEDED,
      payload,
    );
  }

  // ─── Cursor (throttled, ephemeral) ────────────────────────────────

  handleCursorUpdate(
    canvasId: string,
    userId: string,
    positionX: number,
    positionY: number,
    selectedObjectIds: string[],
  ): void {
    const now = Date.now();
    const existing = this.cursors.get(userId);

    if (existing && now - existing.lastEmittedAt < CURSOR_THROTTLE_MS) {
      // Update state but don't emit — still within throttle window
      existing.positionX = positionX;
      existing.positionY = positionY;
      existing.selectedObjectIds = selectedObjectIds;
      return;
    }

    this.cursors.set(userId, {
      positionX,
      positionY,
      selectedObjectIds,
      lastEmittedAt: now,
    });

    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_CURSOR, {
      canvas_id: canvasId,
      user_id: userId,
      position_x: positionX,
      position_y: positionY,
      selected_object_ids: selectedObjectIds,
    } satisfies CanvasCursorPayload);
  }

  /** Flush any pending cursor state for a disconnecting user. */
  flushCursor(userId: string): void {
    this.cursors.delete(userId);
  }

  // ─── Presence (ephemeral join/leave) ──────────────────────────────

  trackPresence(canvasId: string, userId: string): void {
    if (!this.presence.has(canvasId)) {
      this.presence.set(canvasId, new Set());
    }
    this.presence.get(canvasId)!.add(userId);

    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_PRESENCE_JOIN, {
      canvas_id: canvasId,
      user_id: userId,
      connection_count: this.presence.get(canvasId)!.size,
    } satisfies CanvasPresencePayload);
  }

  untrackPresence(canvasId: string, userId: string): void {
    const users = this.presence.get(canvasId);
    if (!users) return;

    users.delete(userId);
    if (users.size === 0) {
      this.presence.delete(canvasId);
    }

    const room = WS_ROOMS.canvas(canvasId);
    this.emitIfListeners(room, WS_EVENTS.CANVAS_PRESENCE_LEAVE, {
      canvas_id: canvasId,
      user_id: userId,
      connection_count: users.size,
    } satisfies CanvasPresencePayload);
  }

  getPresenceCount(canvasId: string): number {
    return this.presence.get(canvasId)?.size ?? 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Only emit if at least one socket is listening in the room,
   * avoiding wasted serialization when no clients are connected.
   */
  private emitIfListeners(
    room: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (this.gateway.hasListeners(room)) {
      this.gateway.emitToRoom(room, event, payload);
    }
  }

  private emitCanvasEvent(
    canvasId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.emitIfListeners(WS_ROOMS.canvas(canvasId), event, payload);
  }
}
