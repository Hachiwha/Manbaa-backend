import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { WsRoomGuardService } from './services/ws-room-guard.service';
import { WS_CLIENT_EVENTS, WS_ERROR_EVENTS, WS_EVENTS, WS_ROOMS } from "./constants/ws-events.constants";
import {
  JoinRoomPayload,
  JoinErrorPayload,
  CanvasCursorPayload,
} from "./interfaces/ws-payloads.interface";

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  /** userId → last emit timestamp — throttles cursor broadcasts */
  private readonly cursorThrottle = new Map<string, number>();

  @WebSocketServer()
  server: Server;

  constructor(private readonly roomGuard: WsRoomGuardService) {}

  // ─── Lifecycle ────────────────────────────────────────────────────

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    const { userId, orgId, role } = client.data || {};
    this.logger.log(
      `Client connected: id=${client.id} userId=${userId} orgId=${orgId} role=${role}`,
    );

    // Auto-join the user's personal room
    if (userId) {
      const userRoom = WS_ROOMS.user(userId);
      client.join(userRoom);
      this.logger.debug(`Client ${client.id} auto-joined room: ${userRoom}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const { userId } = client.data || {};
    this.logger.log(
      `Client disconnected: id=${client.id} userId=${userId}`,
    );
    // Clean up throttle state
    if (userId) {
      this.cursorThrottle.delete(userId);
    }
    // Socket.IO automatically removes the client from all rooms on disconnect
  }

  // ─── Client → Server Events ──────────────────────────────────────

  @SubscribeMessage(WS_CLIENT_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @MessageBody() data: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { room } = data;

    const result = await this.roomGuard.canJoin(client, room);

    if (!result.allowed) {
      const errorPayload: JoinErrorPayload = {
        room,
        reason: result.reason || 'Unauthorized',
      };
      client.emit(WS_ERROR_EVENTS.JOIN_ERROR, errorPayload);

      // Disconnect for cross-org violations and admin-health unauthorized access
      if (
        result.reason?.includes('does not belong to your organization') ||
        result.reason?.includes('not in your organization') ||
        result.reason === 'Admin role required'
      ) {
        this.logger.warn(
          `Disconnecting client ${client.id} after unauthorized room join attempt: ${room}`,
        );
        client.disconnect(true);
      }
      return;
    }

    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(
    @MessageBody() data: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const { room } = data;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.CURSOR_UPDATE)
  handleCursorUpdate(
    @MessageBody()
    data: {
      canvas_id: string;
      position_x: number;
      position_y: number;
      selected_object_ids?: string[];
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const { userId } = client.data || {};
    if (!userId) return;

    const now = Date.now();
    const lastEmit = this.cursorThrottle.get(userId) ?? 0;

    if (now - lastEmit < 50) {
      return; // throttle — drop this update silently
    }

    this.cursorThrottle.set(userId, now);

    const room = WS_ROOMS.canvas(data.canvas_id);
    const payload: CanvasCursorPayload = {
      canvas_id: data.canvas_id,
      user_id: userId,
      position_x: data.position_x,
      position_y: data.position_y,
      selected_object_ids: data.selected_object_ids ?? [],
    };

    if (this.hasListeners(room)) {
      this.server?.to(room).emit(WS_EVENTS.CANVAS_CURSOR, payload);
    }
  }

  // ─── Server → Client Emitters (used by bridge & emitter service) ──

  emitToSession(sessionId: string, event: string, payload: Record<string, unknown>): void {
    const room = WS_ROOMS.session(sessionId);
    this.server?.to(room).emit(event, payload);
  }

  emitToWorkflow(workflowId: string, event: string, payload: Record<string, unknown>): void {
    const room = WS_ROOMS.workflow(workflowId);
    this.server?.to(room).emit(event, payload);
  }

  emitToPipeline(
    pipelineExecutionId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    const room = WS_ROOMS.pipeline(pipelineExecutionId);
    this.server?.to(room).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: Record<string, unknown>): void {
    const room = WS_ROOMS.user(userId);
    this.server?.to(room).emit(event, payload);
  }

  emitToAdminHealth(event: string, payload: Record<string, unknown>): void {
    this.server?.to(WS_ROOMS.adminHealth).emit(event, payload);
  }

  /**
   * Generic room emitter — backward-compatible escape hatch for modules
   * that need to emit to arbitrary room names (e.g. health, rules).
   */
  emitToRoom(room: string, event: string, payload: Record<string, unknown>): void {
    this.server?.to(room).emit(event, payload);
  }

  /**
   * Check whether a room currently has any connected sockets.
   * Used by the NATS bridge for backpressure — messages for empty rooms are dropped.
   */
  hasListeners(room: string): boolean {
    if (!this.server) return false;
    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    return !!roomSockets && roomSockets.size > 0;
  }

  async disconnectWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      await socket.leave(`workspace:${workspaceId}`);
      socket.emit('workspace.access.revoked', { workspaceId });
      socket.disconnect(true);
    }
  }
}
