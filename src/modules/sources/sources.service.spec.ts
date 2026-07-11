import { BadRequestException, ForbiddenException } from "@nestjs/common";

import {
  Source,
  SourceKind,
  SourceProcessingStatus,
  SourceStatus,
  SourceVersion,
} from "./entities";
import { SourcesService } from "./sources.service";

jest.mock("./source-validation.util", () => ({
  ...jest.requireActual("./source-validation.util"),
  validateSourceMimeType: jest.fn().mockResolvedValue("text/plain"),
}));

describe("SourcesService", () => {
  const organizationId = "22222222-2222-4222-8222-222222222222";
  const workspaceId = "33333333-3333-4333-8333-333333333333";
  const projectId = "44444444-4444-4444-8444-444444444444";
  const userId = "66666666-6666-4666-8666-666666666666";
  const correlationId = "55555555-5555-4555-8555-555555555555";
  const buffer = Buffer.from("hello world\n");
  const file = {
    originalname: "brief.txt",
    mimetype: "text/plain",
    size: buffer.length,
    buffer,
  } as Express.Multer.File;

  function setup() {
    const manager = {
      create: jest.fn((entity, value) => Object.assign(new entity(), value)),
      save: jest.fn(async (value) => {
        if (value instanceof SourceVersion && !value.createdAt) {
          value.createdAt = new Date("2026-07-10T12:00:00Z");
        }
        return value;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const permissions = {
      requireEditor: jest
        .fn()
        .mockResolvedValue({ organizationId, workspaceId, userId }),
    };
    const projects = { exist: jest.fn().mockResolvedValue(true) };
    const storage = {
      buildSourceObjectPath: jest.fn(
        (ctx, sourceId, sourceVersionId, filename) =>
          `organizations/${ctx.organizationId}/workspaces/${ctx.workspaceId}/sources/${sourceId}/versions/${sourceVersionId}/${filename}`,
      ),
      storeSource: jest.fn(async (_ctx, key) => ({
        bucket: "workspace-sources",
        key,
        checksumSha256: "a".repeat(64),
      })),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = { create: jest.fn().mockResolvedValue({}) };
    const context = {
      getCorrelationId: jest.fn().mockReturnValue(correlationId),
    };
    const service = new SourcesService(
      projects as never,
      dataSource as never,
      permissions as never,
      storage as never,
      outbox as never,
      context as never,
    );
    return {
      service,
      manager,
      dataSource,
      permissions,
      projects,
      storage,
      outbox,
    };
  }

  it("stores source, version, and exact canonical event through one transaction", async () => {
    const dependencies = setup();
    const response = await dependencies.service.upload(
      workspaceId,
      { projectId },
      file,
      { id: userId, orgId: organizationId },
    );

    expect(dependencies.permissions.requireEditor).toHaveBeenCalledWith(
      userId,
      workspaceId,
      organizationId,
    );
    expect(dependencies.projects.exist).toHaveBeenCalledWith({
      where: { id: projectId, orgId: organizationId },
    });
    expect(dependencies.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(dependencies.manager.create).toHaveBeenCalledWith(
      Source,
      expect.objectContaining({
        id: response.sourceId,
        organizationId,
        workspaceId,
        projectId,
        name: "brief.txt",
        kind: SourceKind.DOCUMENT,
        status: SourceStatus.PENDING,
        currentVersionId: null,
        createdBy: userId,
      }),
    );
    expect(dependencies.manager.create).toHaveBeenCalledWith(
      SourceVersion,
      expect.objectContaining({
        id: response.sourceVersionId,
        sourceId: response.sourceId,
        organizationId,
        workspaceId,
        versionNumber: 1,
        storageBucket: "workspace-sources",
        filename: "brief.txt",
        mimeType: "text/plain",
        sizeBytes: 12,
        checksumSha256: "a".repeat(64),
        processingStatus: SourceProcessingStatus.PENDING,
        createdBy: userId,
      }),
    );
    const savedSources = dependencies.manager.save.mock.calls
      .map(([value]) => value)
      .filter((value) => value instanceof Source);
    expect(savedSources).toHaveLength(2);
    expect(savedSources.at(-1)).toEqual(
      expect.objectContaining({ currentVersionId: response.sourceVersionId }),
    );

    const [, outboxInput, options] = dependencies.outbox.create.mock.calls[0];
    expect(options).toEqual({
      eventId: outboxInput.payload.event_id,
      eventIdField: "event_id",
    });
    expect(outboxInput.eventType).toBe("workspace.source.process.requested");
    expect(outboxInput.payload).toEqual({
      event_id: options.eventId,
      event_type: "workspace.source.process.requested",
      occurred_at: expect.any(String),
      organization_id: organizationId,
      workspace_id: workspaceId,
      project_id: projectId,
      correlation_id: correlationId,
      causation_id: null,
      actor: { type: "user", id: userId },
      payload: {
        source_id: response.sourceId,
        source_version_id: response.sourceVersionId,
        storage_bucket: "workspace-sources",
        storage_key: `organizations/${organizationId}/workspaces/${workspaceId}/sources/${response.sourceId}/versions/${response.sourceVersionId}/brief.txt`,
        filename: "brief.txt",
        mime_type: "text/plain",
        size_bytes: 12,
        checksum_sha256: "a".repeat(64),
      },
    });
    expect(outboxInput.payload).not.toHaveProperty("eventId");
    expect(dependencies.outbox.create).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      sourceId: expect.any(String),
      sourceVersionId: expect.any(String),
      versionNumber: 1,
      status: SourceProcessingStatus.PENDING,
      filename: "brief.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      checksumSha256: "a".repeat(64),
      createdAt: "2026-07-10T12:00:00.000Z",
    });
  });

  it("fails closed before storage for a non-editor or organization mismatch", async () => {
    const dependencies = setup();
    dependencies.permissions.requireEditor.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      dependencies.service.upload(workspaceId, {}, file, {
        id: userId,
        orgId: organizationId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.storage.storeSource).not.toHaveBeenCalled();
  });

  it("requires a multipart file", async () => {
    const dependencies = setup();
    await expect(
      dependencies.service.upload(workspaceId, {}, undefined, {
        id: userId,
        orgId: organizationId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects inconsistent multipart size metadata before storage", async () => {
    const dependencies = setup();
    await expect(
      dependencies.service.upload(
        workspaceId,
        {},
        { ...file, size: file.size + 1 },
        { id: userId, orgId: organizationId },
      ),
    ).rejects.toThrow("size metadata is inconsistent");
    expect(dependencies.storage.storeSource).not.toHaveBeenCalled();
  });

  it("removes the stored object when the database transaction rolls back", async () => {
    const dependencies = setup();
    dependencies.dataSource.transaction.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      dependencies.service.upload(workspaceId, {}, file, {
        id: userId,
        orgId: organizationId,
      }),
    ).rejects.toThrow("database unavailable");
    expect(dependencies.storage.deleteObject).toHaveBeenCalledWith(
      { organizationId, workspaceId },
      "workspace-sources",
      expect.stringContaining("/sources/"),
    );
  });

  it("removes an object written to a misconfigured source bucket", async () => {
    const dependencies = setup();
    dependencies.storage.storeSource.mockResolvedValueOnce({
      bucket: "unexpected-source-bucket",
      key: `organizations/${organizationId}/workspaces/${workspaceId}/sources/source/versions/version/brief.txt`,
      checksumSha256: "a".repeat(64),
    });

    await expect(
      dependencies.service.upload(workspaceId, {}, file, {
        id: userId,
        orgId: organizationId,
      }),
    ).rejects.toThrow("workspace-sources");
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
    expect(dependencies.storage.deleteObject).toHaveBeenCalledWith(
      { organizationId, workspaceId },
      "unexpected-source-bucket",
      expect.any(String),
    );
  });

  it("preserves the transaction error when orphan cleanup also fails", async () => {
    const dependencies = setup();
    dependencies.dataSource.transaction.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    dependencies.storage.deleteObject.mockRejectedValueOnce(
      new Error("storage cleanup unavailable"),
    );

    await expect(
      dependencies.service.upload(workspaceId, {}, file, {
        id: userId,
        orgId: organizationId,
      }),
    ).rejects.toThrow("database unavailable");
  });
});
