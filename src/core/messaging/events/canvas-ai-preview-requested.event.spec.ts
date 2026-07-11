import fixture = require("../../../../contracts/fixtures/canvas-ai-preview-requested.json");

import {
  assertCanvasAiPreviewRequestedEvent,
  createCanvasAiPreviewRequestedEvent,
  MAX_CANVAS_AI_ELEMENT_IDS,
  MAX_CANVAS_AI_PROMPT_CHARACTERS,
} from "./canvas-ai-preview-requested.event";

describe("workspace.canvas.ai.preview.requested contract", () => {
  it("builds the exact authoritative snake_case fixture", () => {
    const event = createCanvasAiPreviewRequestedEvent({
      eventId: fixture.event_id,
      occurredAt: fixture.occurred_at,
      organizationId: fixture.organization_id,
      workspaceId: fixture.workspace_id,
      projectId: fixture.project_id,
      correlationId: fixture.correlation_id,
      causationId: fixture.causation_id,
      actor: fixture.actor as { type: "user"; id: string },
      payload: {
        taskId: fixture.payload.task_id,
        canvasId: fixture.payload.canvas_id,
        canvasRevision: fixture.payload.canvas_revision,
        snapshotId: fixture.payload.snapshot_id,
        snapshotVersion: fixture.payload.snapshot_version,
        storageBucket: fixture.payload.storage_bucket as "workspace-snapshots",
        storageKey: fixture.payload.storage_key,
        checksumSha256: fixture.payload.checksum_sha256,
        previewStatus: fixture.payload.preview_status as "pending",
        previewBucket: null,
        previewKey: null,
        previewChecksumSha256: null,
        operation: fixture.payload.operation as "improve_selection",
        selectedElementIds: fixture.payload.selected_element_ids,
        lockedElementIds: fixture.payload.locked_element_ids,
        editableElementIds: fixture.payload.editable_element_ids,
        sourceIds: fixture.payload.source_ids,
        userPrompt: fixture.payload.user_prompt,
        desiredWidth: fixture.payload.desired_width,
        desiredHeight: fixture.payload.desired_height,
      },
    });

    expect(event).toEqual(fixture);
    expect(() => assertCanvasAiPreviewRequestedEvent(fixture)).not.toThrow();
    expect(JSON.stringify(event)).not.toContain('"elements"');
    expect(JSON.stringify(event)).not.toContain('"snapshot_json"');
  });

  it.each([
    ["negative revision", { canvas_revision: -1 }],
    ["zero snapshot version", { snapshot_version: 0 }],
    ["wrong bucket", { storage_bucket: "workspace-temp" }],
    ["wrong key", { storage_key: "../snapshot.json" }],
    ["bad checksum", { checksum_sha256: "bad" }],
    ["unsupported operation", { operation: "delete_canvas" }],
    ["zero width", { desired_width: 0 }],
    ["oversized height", { desired_height: 65537 }],
    ["locked/editable overlap", { locked_element_ids: ["hero-title"] }],
    [
      "pending preview with a key",
      { preview_key: "organizations/x/preview.png" },
    ],
  ])("rejects %s", (_label, change) => {
    expect(() =>
      assertCanvasAiPreviewRequestedEvent({
        ...fixture,
        payload: { ...fixture.payload, ...change },
      }),
    ).toThrow(TypeError);
  });

  it("rejects oversized lists and prompts", () => {
    expect(() =>
      assertCanvasAiPreviewRequestedEvent({
        ...fixture,
        payload: {
          ...fixture.payload,
          selected_element_ids: Array.from(
            { length: MAX_CANVAS_AI_ELEMENT_IDS + 1 },
            (_, index) => `element-${index}`,
          ),
        },
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertCanvasAiPreviewRequestedEvent({
        ...fixture,
        payload: {
          ...fixture.payload,
          user_prompt: "x".repeat(MAX_CANVAS_AI_PROMPT_CHARACTERS + 1),
        },
      }),
    ).toThrow(TypeError);
  });

  it.each(["", "   ", "contains\u0000null"])(
    "rejects blank or null-containing prompt %p",
    (userPrompt) => {
      expect(() =>
        assertCanvasAiPreviewRequestedEvent({
          ...fixture,
          payload: { ...fixture.payload, user_prompt: userPrompt },
        }),
      ).toThrow(TypeError);
    },
  );

  it("allows a bounded multiline prompt", () => {
    expect(() =>
      assertCanvasAiPreviewRequestedEvent({
        ...fixture,
        payload: {
          ...fixture.payload,
          user_prompt: "Improve this heading\nKeep the exact visible text",
        },
      }),
    ).not.toThrow();
  });

  it("rejects camelCase or unknown fields", () => {
    expect(() =>
      assertCanvasAiPreviewRequestedEvent({
        ...fixture,
        eventId: fixture.event_id,
      }),
    ).toThrow("fields do not match the canonical contract");
  });
});
