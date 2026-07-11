import { randomUUID } from "crypto";
import { validate as validateUuid } from "uuid";

import { SUBJECTS_V2 } from "../subjects";

export const CANVAS_AI_PREVIEW_OPERATIONS = [
  "improve_canvas",
  "improve_selection",
  "generate_component",
  "generate_image",
] as const;

export type CanvasAiPreviewOperation =
  (typeof CANVAS_AI_PREVIEW_OPERATIONS)[number];
export type CanvasAiPreviewStatus = "available" | "pending";

export const MAX_CANVAS_AI_ELEMENT_IDS = 100;
export const MAX_CANVAS_AI_SOURCE_IDS = 100;
export const MAX_CANVAS_AI_PROMPT_CHARACTERS = 4000;
export const MAX_CANVAS_AI_DIMENSION = 65536;

export interface CanvasAiPreviewRequestedEvent {
  event_id: string;
  event_type: typeof SUBJECTS_V2.CANVAS_AI_PREVIEW_REQUESTED;
  occurred_at: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  actor: {
    type: "user" | "service";
    id: string;
  };
  payload: {
    task_id: string;
    canvas_id: string;
    canvas_revision: number;
    snapshot_id: string;
    snapshot_version: number;
    storage_bucket: "workspace-snapshots";
    storage_key: string;
    checksum_sha256: string;
    preview_status: CanvasAiPreviewStatus;
    preview_bucket: "workspace-previews" | null;
    preview_key: string | null;
    preview_checksum_sha256: string | null;
    operation: CanvasAiPreviewOperation;
    selected_element_ids: string[];
    locked_element_ids: string[];
    editable_element_ids: string[];
    source_ids: string[];
    user_prompt: string;
    desired_width: number;
    desired_height: number;
  };
}

export interface CreateCanvasAiPreviewRequestedEventInput {
  eventId?: string;
  occurredAt?: string;
  organizationId: string;
  workspaceId: string;
  projectId: string | null;
  correlationId: string;
  causationId?: string | null;
  actor: CanvasAiPreviewRequestedEvent["actor"];
  payload: {
    taskId: string;
    canvasId: string;
    canvasRevision: number;
    snapshotId: string;
    snapshotVersion: number;
    storageBucket: "workspace-snapshots";
    storageKey: string;
    checksumSha256: string;
    previewStatus: CanvasAiPreviewStatus;
    previewBucket: "workspace-previews" | null;
    previewKey: string | null;
    previewChecksumSha256: string | null;
    operation: CanvasAiPreviewOperation;
    selectedElementIds: string[];
    lockedElementIds: string[];
    editableElementIds: string[];
    sourceIds: string[];
    userPrompt: string;
    desiredWidth: number;
    desiredHeight: number;
  };
}

const TOP_LEVEL_FIELDS = [
  "event_id",
  "event_type",
  "occurred_at",
  "organization_id",
  "workspace_id",
  "project_id",
  "correlation_id",
  "causation_id",
  "actor",
  "payload",
] as const;
const ACTOR_FIELDS = ["type", "id"] as const;
const PAYLOAD_FIELDS = [
  "task_id",
  "canvas_id",
  "canvas_revision",
  "snapshot_id",
  "snapshot_version",
  "storage_bucket",
  "storage_key",
  "checksum_sha256",
  "preview_status",
  "preview_bucket",
  "preview_key",
  "preview_checksum_sha256",
  "operation",
  "selected_element_ids",
  "locked_element_ids",
  "editable_element_ids",
  "source_ids",
  "user_prompt",
  "desired_width",
  "desired_height",
] as const;

export function createCanvasAiPreviewRequestedEvent(
  input: CreateCanvasAiPreviewRequestedEventInput,
): CanvasAiPreviewRequestedEvent {
  const event: CanvasAiPreviewRequestedEvent = {
    event_id: input.eventId ?? randomUUID(),
    event_type: SUBJECTS_V2.CANVAS_AI_PREVIEW_REQUESTED,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    organization_id: input.organizationId,
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    actor: input.actor,
    payload: {
      task_id: input.payload.taskId,
      canvas_id: input.payload.canvasId,
      canvas_revision: input.payload.canvasRevision,
      snapshot_id: input.payload.snapshotId,
      snapshot_version: input.payload.snapshotVersion,
      storage_bucket: input.payload.storageBucket,
      storage_key: input.payload.storageKey,
      checksum_sha256: input.payload.checksumSha256,
      preview_status: input.payload.previewStatus,
      preview_bucket: input.payload.previewBucket,
      preview_key: input.payload.previewKey,
      preview_checksum_sha256: input.payload.previewChecksumSha256,
      operation: input.payload.operation,
      selected_element_ids: [...input.payload.selectedElementIds],
      locked_element_ids: [...input.payload.lockedElementIds],
      editable_element_ids: [...input.payload.editableElementIds],
      source_ids: [...input.payload.sourceIds],
      user_prompt: input.payload.userPrompt,
      desired_width: input.payload.desiredWidth,
      desired_height: input.payload.desiredHeight,
    },
  };

  assertCanvasAiPreviewRequestedEvent(event);
  return event;
}

export function assertCanvasAiPreviewRequestedEvent(
  value: unknown,
): asserts value is CanvasAiPreviewRequestedEvent {
  const event = asRecord(value, "Canvas AI preview event");
  assertExactFields(event, TOP_LEVEL_FIELDS, "Canvas AI preview event");
  assertUuid(event.event_id, "event_id");
  if (event.event_type !== SUBJECTS_V2.CANVAS_AI_PREVIEW_REQUESTED) {
    throw new TypeError(
      `event_type must be ${SUBJECTS_V2.CANVAS_AI_PREVIEW_REQUESTED}`,
    );
  }
  assertTimezoneAwareTimestamp(event.occurred_at, "occurred_at");
  assertUuid(event.organization_id, "organization_id");
  assertUuid(event.workspace_id, "workspace_id");
  if (event.project_id !== null) assertUuid(event.project_id, "project_id");
  assertUuid(event.correlation_id, "correlation_id");
  if (event.causation_id !== null) {
    assertUuid(event.causation_id, "causation_id");
  }

  const actor = asRecord(event.actor, "actor");
  assertExactFields(actor, ACTOR_FIELDS, "actor");
  if (actor.type !== "user" && actor.type !== "service") {
    throw new TypeError("actor.type must be user or service");
  }
  assertBoundedString(actor.id, "actor.id", 255, "all");

  const payload = asRecord(event.payload, "payload");
  assertExactFields(payload, PAYLOAD_FIELDS, "payload");
  assertUuid(payload.task_id, "payload.task_id");
  assertUuid(payload.canvas_id, "payload.canvas_id");
  assertNonnegativeSafeInteger(
    payload.canvas_revision,
    "payload.canvas_revision",
  );
  assertUuid(payload.snapshot_id, "payload.snapshot_id");
  assertPositiveSafeInteger(
    payload.snapshot_version,
    "payload.snapshot_version",
  );
  if (payload.storage_bucket !== "workspace-snapshots") {
    throw new TypeError("payload.storage_bucket must be workspace-snapshots");
  }
  const expectedStorageKey = snapshotKey(
    event.organization_id as string,
    event.workspace_id as string,
    payload.canvas_id as string,
    payload.snapshot_id as string,
    payload.snapshot_version as number,
  );
  if (payload.storage_key !== expectedStorageKey) {
    throw new TypeError(
      "payload.storage_key must exactly match the canonical tenant snapshot path",
    );
  }
  assertSha256(payload.checksum_sha256, "payload.checksum_sha256");
  assertPreviewFields(event, payload);

  if (
    typeof payload.operation !== "string" ||
    !CANVAS_AI_PREVIEW_OPERATIONS.includes(
      payload.operation as CanvasAiPreviewOperation,
    )
  ) {
    throw new TypeError("payload.operation is not supported");
  }
  assertElementIds(
    payload.selected_element_ids,
    "payload.selected_element_ids",
  );
  const lockedIds = assertElementIds(
    payload.locked_element_ids,
    "payload.locked_element_ids",
  );
  const editableIds = assertElementIds(
    payload.editable_element_ids,
    "payload.editable_element_ids",
  );
  const locked = new Set(lockedIds);
  if (editableIds.some((id) => locked.has(id))) {
    throw new TypeError(
      "payload.locked_element_ids and payload.editable_element_ids must not overlap",
    );
  }
  assertSourceIds(payload.source_ids, "payload.source_ids");
  assertBoundedString(
    payload.user_prompt,
    "payload.user_prompt",
    MAX_CANVAS_AI_PROMPT_CHARACTERS,
    "null",
  );
  assertDimension(payload.desired_width, "payload.desired_width");
  assertDimension(payload.desired_height, "payload.desired_height");
}

function assertPreviewFields(
  event: Record<string, unknown>,
  payload: Record<string, unknown>,
): void {
  if (payload.preview_status === "pending") {
    if (
      payload.preview_bucket !== null ||
      payload.preview_key !== null ||
      payload.preview_checksum_sha256 !== null
    ) {
      throw new TypeError(
        "pending preview fields must not claim an unavailable artifact",
      );
    }
    return;
  }
  if (payload.preview_status !== "available") {
    throw new TypeError("payload.preview_status must be available or pending");
  }
  if (payload.preview_bucket !== "workspace-previews") {
    throw new TypeError(
      "available payload.preview_bucket must be workspace-previews",
    );
  }
  const expectedPreviewKey = previewKey(
    event.organization_id as string,
    event.workspace_id as string,
    payload.canvas_id as string,
    payload.snapshot_id as string,
    payload.snapshot_version as number,
  );
  if (payload.preview_key !== expectedPreviewKey) {
    throw new TypeError(
      "payload.preview_key must exactly match the canonical tenant preview path",
    );
  }
  assertSha256(
    payload.preview_checksum_sha256,
    "payload.preview_checksum_sha256",
  );
}

function assertElementIds(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_CANVAS_AI_ELEMENT_IDS) {
    throw new TypeError(
      `${field} must be an array of at most ${MAX_CANVAS_AI_ELEMENT_IDS} IDs`,
    );
  }
  const result = value.map((item) => {
    if (
      typeof item !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(item)
    ) {
      throw new TypeError(`${field} contains an unsafe element ID`);
    }
    return item;
  });
  if (new Set(result).size !== result.length) {
    throw new TypeError(`${field} must not contain duplicate IDs`);
  }
  return result;
}

function assertSourceIds(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.length > MAX_CANVAS_AI_SOURCE_IDS) {
    throw new TypeError(
      `${field} must be an array of at most ${MAX_CANVAS_AI_SOURCE_IDS} IDs`,
    );
  }
  value.forEach((item, index) => assertUuid(item, `${field}[${index}]`));
  if (new Set(value).size !== value.length) {
    throw new TypeError(`${field} must not contain duplicate IDs`);
  }
}

function assertDimension(value: unknown, field: string): void {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_CANVAS_AI_DIMENSION
  ) {
    throw new TypeError(
      `${field} must be an integer between 1 and ${MAX_CANVAS_AI_DIMENSION}`,
    );
  }
}

function assertPositiveSafeInteger(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
}

function assertNonnegativeSafeInteger(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
}

function assertSha256(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${field} must be a lowercase SHA-256 hex digest`);
  }
}

function assertTimezoneAwareTimestamp(value: unknown, field: string): void {
  if (
    typeof value !== "string" ||
    Number.isNaN(Date.parse(value)) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
    throw new TypeError(`${field} must be timezone-aware ISO-8601`);
  }
}

function assertBoundedString(
  value: unknown,
  field: string,
  maximumCharacters: number,
  controlPolicy: "all" | "null",
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    Array.from(value).length > maximumCharacters ||
    (controlPolicy === "all"
      ? hasControlCharacter(value)
      : value.includes("\u0000"))
  ) {
    throw new TypeError(
      `${field} must be a safe string of at most ${maximumCharacters} characters`,
    );
  }
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !validateUuid(value)) {
    throw new TypeError(`${field} must be a UUID`);
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  value: Record<string, unknown>,
  expectedFields: readonly string[],
  field: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(`${field} fields do not match the canonical contract`);
  }
}

function snapshotKey(
  organizationId: string,
  workspaceId: string,
  canvasId: string,
  snapshotId: string,
  snapshotVersion: number,
): string {
  return `organizations/${organizationId}/workspaces/${workspaceId}/canvases/${canvasId}/snapshots/${snapshotId}/snapshot-v${snapshotVersion}.json`;
}

function previewKey(
  organizationId: string,
  workspaceId: string,
  canvasId: string,
  snapshotId: string,
  snapshotVersion: number,
): string {
  return `organizations/${organizationId}/workspaces/${workspaceId}/canvases/${canvasId}/snapshots/${snapshotId}/preview-v${snapshotVersion}.png`;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
