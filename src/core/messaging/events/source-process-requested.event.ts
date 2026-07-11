import { randomUUID } from "crypto";
import { validate as validateUuid } from "uuid";

import { SUBJECTS_V2 } from "../subjects";

export const SOURCE_PROCESS_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type SourceProcessMimeType = (typeof SOURCE_PROCESS_MIME_TYPES)[number];

export interface SourceProcessRequestedEvent {
  event_id: string;
  event_type: typeof SUBJECTS_V2.SOURCE_PROCESS_REQUESTED;
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
    source_id: string;
    source_version_id: string;
    storage_bucket: string;
    storage_key: string;
    filename: string;
    mime_type: SourceProcessMimeType;
    size_bytes: number;
    checksum_sha256: string;
  };
}

export type CreateSourceProcessRequestedEventInput = {
  eventId?: string;
  occurredAt?: string;
  organizationId: string;
  workspaceId: string;
  projectId: string | null;
  correlationId: string;
  causationId?: string | null;
  actor: SourceProcessRequestedEvent["actor"];
  payload: {
    sourceId: string;
    sourceVersionId: string;
    storageBucket: string;
    storageKey: string;
    filename: string;
    mimeType: SourceProcessMimeType;
    sizeBytes: number;
    checksumSha256: string;
  };
};

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
  "source_id",
  "source_version_id",
  "storage_bucket",
  "storage_key",
  "filename",
  "mime_type",
  "size_bytes",
  "checksum_sha256",
] as const;

export function createSourceProcessRequestedEvent(
  input: CreateSourceProcessRequestedEventInput,
): SourceProcessRequestedEvent {
  const event: SourceProcessRequestedEvent = {
    event_id: input.eventId ?? randomUUID(),
    event_type: SUBJECTS_V2.SOURCE_PROCESS_REQUESTED,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    organization_id: input.organizationId,
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    actor: input.actor,
    payload: {
      source_id: input.payload.sourceId,
      source_version_id: input.payload.sourceVersionId,
      storage_bucket: input.payload.storageBucket,
      storage_key: input.payload.storageKey,
      filename: input.payload.filename,
      mime_type: input.payload.mimeType,
      size_bytes: input.payload.sizeBytes,
      checksum_sha256: input.payload.checksumSha256,
    },
  };

  assertSourceProcessRequestedEvent(event);
  return event;
}

export function assertSourceProcessRequestedEvent(
  value: unknown,
): asserts value is SourceProcessRequestedEvent {
  const event = asRecord(value, "Source processing event");
  assertExactFields(event, TOP_LEVEL_FIELDS, "Source processing event");

  assertUuid(event.event_id, "event_id");
  if (event.event_type !== SUBJECTS_V2.SOURCE_PROCESS_REQUESTED) {
    throw new TypeError(
      `event_type must be ${SUBJECTS_V2.SOURCE_PROCESS_REQUESTED}`,
    );
  }
  if (
    typeof event.occurred_at !== "string" ||
    Number.isNaN(Date.parse(event.occurred_at)) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(event.occurred_at)
  ) {
    throw new TypeError("occurred_at must be timezone-aware ISO-8601");
  }
  assertUuid(event.organization_id, "organization_id");
  assertUuid(event.workspace_id, "workspace_id");
  if (event.project_id !== null) assertUuid(event.project_id, "project_id");
  assertUuid(event.correlation_id, "correlation_id");
  if (event.causation_id !== null)
    assertUuid(event.causation_id, "causation_id");

  const actor = asRecord(event.actor, "actor");
  assertExactFields(actor, ACTOR_FIELDS, "actor");
  if (actor.type !== "user" && actor.type !== "service") {
    throw new TypeError("actor.type must be user or service");
  }
  if (
    typeof actor.id !== "string" ||
    actor.id.length === 0 ||
    actor.id.length > 255
  ) {
    throw new TypeError(
      "actor.id must be a non-empty string of at most 255 characters",
    );
  }

  const payload = asRecord(event.payload, "payload");
  assertExactFields(payload, PAYLOAD_FIELDS, "payload");
  assertUuid(payload.source_id, "payload.source_id");
  assertUuid(payload.source_version_id, "payload.source_version_id");
  if (payload.storage_bucket !== "workspace-sources") {
    throw new TypeError("payload.storage_bucket must be workspace-sources");
  }
  if (
    typeof payload.filename !== "string" ||
    payload.filename.length === 0 ||
    Buffer.byteLength(payload.filename, "utf8") > 255 ||
    payload.filename === "." ||
    payload.filename === ".." ||
    payload.filename.includes("/") ||
    payload.filename.includes("\\") ||
    hasControlCharacter(payload.filename)
  ) {
    throw new TypeError("payload.filename must be a safe non-empty filename");
  }
  assertStorageKey(
    payload.storage_key,
    event.organization_id as string,
    event.workspace_id as string,
    payload.source_id as string,
    payload.source_version_id as string,
    payload.filename,
  );
  if (
    typeof payload.mime_type !== "string" ||
    !SOURCE_PROCESS_MIME_TYPES.includes(
      payload.mime_type as SourceProcessMimeType,
    )
  ) {
    throw new TypeError("payload.mime_type is not supported");
  }
  if (
    typeof payload.size_bytes !== "number" ||
    !Number.isSafeInteger(payload.size_bytes) ||
    payload.size_bytes < 0
  ) {
    throw new TypeError(
      "payload.size_bytes must be a non-negative safe integer",
    );
  }
  if (
    typeof payload.checksum_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload.checksum_sha256)
  ) {
    throw new TypeError(
      "payload.checksum_sha256 must be a lowercase SHA-256 hex digest",
    );
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
  fields: readonly string[],
  field: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(`${field} fields do not match the canonical contract`);
  }
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !validateUuid(value)) {
    throw new TypeError(`${field} must be a UUID`);
  }
}

function assertStorageKey(
  value: unknown,
  organizationId: string,
  workspaceId: string,
  sourceId: string,
  sourceVersionId: string,
  filename: string,
): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("payload.storage_key must be a non-empty string");
  }

  if (Buffer.byteLength(value, "utf8") > 1024) {
    throw new TypeError("payload.storage_key must be at most 1024 UTF-8 bytes");
  }

  const expectedKey = `organizations/${organizationId}/workspaces/${workspaceId}/sources/${sourceId}/versions/${sourceVersionId}/${filename}`;
  if (value !== expectedKey) {
    throw new TypeError(
      "payload.storage_key must exactly match the canonical tenant source path",
    );
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
