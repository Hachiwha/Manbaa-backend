/**
 * Authoritative server → client WebSocket event catalog.
 * Both FE and BE-10 reference this list.
 */
export const WS_EVENTS = {
  // Pipeline / Agent events
  PIPELINE_PROGRESS: 'pipeline.progress',
  AGENT_LOG: 'agent.log',
  AGENT_STATUS: 'agent.status',

  // Workflow events
  WORKFLOW_UPDATED: 'workflow.updated',

  // Session events
  SESSION_STATE: 'session.state',
  SESSION_NEEDS_RECONCILIATION: 'session.needs_reconciliation',
  SESSION_FINALIZED: 'session.finalized',

  // Document events
  DOCUMENT_READY: 'document.ready',

  // Collaboration events
  COMMENT_CREATED: 'comment.created',
  COMMENT_RESOLVED: 'comment.resolved',

  // Divergence events
  DIVERGENCE_REPORT_READY: 'divergence.report.ready',
  DIVERGENCE_REPORT_UPDATED: 'divergence.report.updated',

  // Rules / Skills events
  RULES_CONFLICT_DETECTED: 'rules.conflict.detected',
  SKILLS_APPLICATION_LOGGED: 'skills.application.logged',

  // System events
  SYSTEM_HEALTH_ALERT: 'system.health.alert',

  // Canvas events
  CANVAS_OBJECT_CREATED: "canvas.object.created",
  CANVAS_OBJECT_UPDATED: "canvas.object.updated",
  CANVAS_OBJECT_MOVED: "canvas.object.moved",
  CANVAS_OBJECT_DELETED: "canvas.object.deleted",
  CANVAS_COMMITTED: "canvas.committed",
  CANVAS_CURSOR: "canvas.cursor",
  CANVAS_PRESENCE_JOIN: "canvas.presence.join",
  CANVAS_PRESENCE_LEAVE: "canvas.presence.leave",
  CANVAS_OPERATION_ACCEPTED: "canvas.operation.accepted",
  CANVAS_OPERATION_REJECTED: "canvas.operation.rejected",
  CANVAS_SNAPSHOT_CREATED: "canvas.snapshot.created",
  CANVAS_AI_PREVIEW_QUEUED: "canvas.ai.preview.queued",
  CANVAS_AI_PREVIEW_STARTED: "canvas.ai.preview.started",
  CANVAS_AI_PREVIEW_PROGRESS: "canvas.ai.preview.progress",
  CANVAS_AI_PREVIEW_READY: "canvas.ai.preview.ready",
  CANVAS_AI_PREVIEW_STALE: "canvas.ai.preview.stale",
  CANVAS_AI_PREVIEW_FAILED: "canvas.ai.preview.failed",
  CANVAS_AI_PREVIEW_CANCELLED: "canvas.ai.preview.cancelled",
  CANVAS_AI_PREVIEW_SUPERSEDED: "canvas.ai.preview.superseded",
  CANVAS_AI_PREVIEW_ACCEPTED: "canvas.ai.preview.accepted",
  CANVAS_AI_PREVIEW_REJECTED: "canvas.ai.preview.rejected",

  // Notification events
  NOTIFICATION_REVIEW_REQUEST: "notification.review_request",
} as const;

/**
 * Room name factories — single source of truth for room key patterns.
 */
export const WS_ROOMS = {
  user: (userId: string) => `user:${userId}`,
  organization: (organizationId: string) => `organization:${organizationId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  workflow: (workflowId: string) => `workflow:${workflowId}`,
  pipeline: (pipelineExecutionId: string) => `pipeline:${pipelineExecutionId}`,
  canvas: (canvasId: string) => `canvas:${canvasId}`,
  adminHealth: "admin-health",
} as const;

/** Client → server events the gateway listens to. */
export const WS_CLIENT_EVENTS = {
  JOIN_ROOM: "joinRoom",
  LEAVE_ROOM: "leaveRoom",
  CURSOR_UPDATE: "cursor.update",
} as const;

/** Emitted back to the client on room-join failure. */
export const WS_ERROR_EVENTS = {
  JOIN_ERROR: 'join_error',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
