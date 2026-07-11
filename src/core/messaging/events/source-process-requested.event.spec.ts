import fixture = require("../../../../contracts/fixtures/source-process-requested.json");

import {
  assertSourceProcessRequestedEvent,
  createSourceProcessRequestedEvent,
} from "./source-process-requested.event";

describe("workspace.source.process.requested contract", () => {
  it("builds the exact cross-repository snake_case fixture", () => {
    const event = createSourceProcessRequestedEvent({
      eventId: fixture.event_id,
      occurredAt: fixture.occurred_at,
      organizationId: fixture.organization_id,
      workspaceId: fixture.workspace_id,
      projectId: fixture.project_id,
      correlationId: fixture.correlation_id,
      causationId: fixture.causation_id,
      actor: fixture.actor as { type: "user"; id: string },
      payload: {
        sourceId: fixture.payload.source_id,
        sourceVersionId: fixture.payload.source_version_id,
        storageBucket: fixture.payload.storage_bucket,
        storageKey: fixture.payload.storage_key,
        filename: fixture.payload.filename,
        mimeType: fixture.payload.mime_type as "text/plain",
        sizeBytes: fixture.payload.size_bytes,
        checksumSha256: fixture.payload.checksum_sha256,
      },
    });

    expect(event).toEqual(fixture);
    expect(Object.keys(event).sort()).toEqual([
      "actor",
      "causation_id",
      "correlation_id",
      "event_id",
      "event_type",
      "occurred_at",
      "organization_id",
      "payload",
      "project_id",
      "workspace_id",
    ]);
    expect(() => assertSourceProcessRequestedEvent(fixture)).not.toThrow();
  });

  it.each([
    ["unsupported MIME", { ...fixture.payload, mime_type: "image/png" }],
    [
      "wrong bucket",
      { ...fixture.payload, storage_bucket: "other-workspace-bucket" },
    ],
    [
      "traversal key",
      {
        ...fixture.payload,
        storage_key: `organizations/${fixture.organization_id}/workspaces/${fixture.workspace_id}/../secret.txt`,
      },
    ],
    [
      "cross-workspace key",
      {
        ...fixture.payload,
        storage_key: `organizations/${fixture.organization_id}/workspaces/99999999-9999-4999-8999-999999999999/sources/a.txt`,
      },
    ],
    [
      "different source key",
      {
        ...fixture.payload,
        storage_key: `organizations/${fixture.organization_id}/workspaces/${fixture.workspace_id}/sources/99999999-9999-4999-8999-999999999999/versions/${fixture.payload.source_version_id}/brief.txt`,
      },
    ],
    [
      "checksum",
      {
        ...fixture.payload,
        checksum_sha256: "not-a-checksum",
      },
    ],
  ])("rejects an invalid %s", (_label, payload) => {
    expect(() =>
      assertSourceProcessRequestedEvent({ ...fixture, payload }),
    ).toThrow(TypeError);
  });

  it("rejects camelCase or unknown envelope fields", () => {
    expect(() =>
      assertSourceProcessRequestedEvent({
        ...fixture,
        eventId: fixture.event_id,
      }),
    ).toThrow("fields do not match the canonical contract");
  });
});
