import { createDomainEvent } from "../../core/messaging/domain-event";
import {
  Source,
  SourceKind,
  SourceLifecycleEvent,
  SourceProcessingStatus,
  SourceStatus,
  SourceVersion,
} from "./entities";
import { SourceLifecycleService } from "./source-lifecycle.service";

describe("SourceLifecycleService", () => {
  const organizationId = "22222222-2222-4222-8222-222222222222";
  const workspaceId = "33333333-3333-4333-8333-333333333333";
  const userId = "66666666-6666-4666-8666-666666666666";
  const sourceId = "77777777-7777-4777-8777-777777777777";
  const sourceVersionId = "88888888-8888-4888-8888-888888888888";

  function setup() {
    const source = Object.assign(new Source(), {
      id: sourceId,
      organizationId,
      workspaceId,
      projectId: null,
      name: "brief.txt",
      kind: SourceKind.DOCUMENT,
      status: SourceStatus.PENDING,
      currentVersionId: sourceVersionId,
      createdBy: userId,
      deletedAt: null,
    });
    const version = Object.assign(new SourceVersion(), {
      id: sourceVersionId,
      sourceId,
      organizationId,
      workspaceId,
      versionNumber: 1,
      processingStatus: SourceProcessingStatus.PENDING,
      extractedAt: null,
      indexedAt: null,
      failureCode: null,
      failureMessage: null,
    });
    const receiptMap = new Map<string, SourceLifecycleEvent>();
    const receipts = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(receiptMap.get(where.eventId) ?? null),
      ),
    };
    const manager = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === SourceLifecycleEvent) {
          return receiptMap.get(options.where.eventId) ?? null;
        }
        if (entity === Source) {
          const where = options.where;
          return where.id === source.id &&
            where.organizationId === source.organizationId &&
            where.workspaceId === source.workspaceId
            ? source
            : null;
        }
        if (entity === SourceVersion) {
          const where = options.where;
          return where.id === version.id &&
            where.sourceId === version.sourceId &&
            where.organizationId === version.organizationId &&
            where.workspaceId === version.workspaceId
            ? version
            : null;
        }
        return null;
      }),
      create: jest.fn((entity, value) => Object.assign(new entity(), value)),
      save: jest.fn(async (value) => {
        if (value instanceof SourceLifecycleEvent)
          receiptMap.set(value.eventId, value);
        return value;
      }),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const nats = { subscribeDurable: jest.fn().mockResolvedValue(undefined) };
    const internalTokens = {
      verify: jest.fn().mockImplementation((token: string) =>
        Promise.resolve({
          jti: token.replace("token-", ""),
          service: "document-worker",
          organizationId,
          workspaceId,
          correlationId: "55555555-5555-4555-8555-555555555555",
          allowedActions: [
            "source.processing",
            "source.extracted",
            "source.indexed",
            "source.failed",
          ],
        }),
      ),
    };
    const realtime = { emitToRoom: jest.fn(), emitToUser: jest.fn() };
    const service = new SourceLifecycleService(
      receipts as never,
      dataSource as never,
      nats as never,
      internalTokens as never,
      realtime as never,
    );
    return {
      service,
      source,
      version,
      receipts,
      receiptMap,
      manager,
      dataSource,
      internalTokens,
      realtime,
      nats,
    };
  }

  function lifecycleEvent(
    kind: "processing" | "extracted" | "indexed" | "failed",
    eventId: string,
    fields: Record<string, unknown> = {},
    scope: { organizationId?: string; workspaceId?: string } = {},
  ): Record<string, unknown> {
    return createDomainEvent({
      eventId,
      eventType: `workspace.source.${kind}`,
      organizationId: scope.organizationId ?? organizationId,
      workspaceId: scope.workspaceId ?? workspaceId,
      userId,
      correlationId: "55555555-5555-4555-8555-555555555555",
      timestamp: "2026-07-10T12:00:00.000Z",
      payload: {
        sourceId,
        sourceVersionId,
        internalToken: `token-${eventId}`,
        ...fields,
      },
    }) as unknown as Record<string, unknown>;
  }

  it("subscribes to all four canonical lifecycle subjects", async () => {
    const { service, nats } = setup();
    await service.onModuleInit();
    expect(nats.subscribeDurable).toHaveBeenCalledTimes(4);
    expect(
      nats.subscribeDurable.mock.calls.map(([options]) => options.subject),
    ).toEqual([
      "workspace.source.processing",
      "workspace.source.extracted",
      "workspace.source.indexed",
      "workspace.source.failed",
    ]);
  });

  it("persists PENDING to PROCESSING to EXTRACTED to INDEXED before notifying", async () => {
    const dependencies = setup();
    await dependencies.service.handle(
      "processing",
      lifecycleEvent("processing", "11111111-1111-4111-8111-111111111111"),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.PROCESSING,
    );
    await dependencies.service.handle(
      "extracted",
      lifecycleEvent("extracted", "22222222-2222-4222-8222-222222222221", {
        chunkCount: 2,
      }),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.EXTRACTED,
    );
    expect(dependencies.version.extractedAt).toEqual(
      new Date("2026-07-10T12:00:00.000Z"),
    );
    await dependencies.service.handle(
      "indexed",
      lifecycleEvent("indexed", "33333333-3333-4333-8333-333333333331", {
        indexedCount: 2,
      }),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.INDEXED,
    );
    expect(dependencies.source.status).toBe(SourceStatus.INDEXED);
    expect(dependencies.realtime.emitToRoom).toHaveBeenCalledTimes(3);
    expect(dependencies.manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.realtime.emitToRoom.mock.invocationCallOrder[0],
    );
  });

  it("acknowledges a duplicate event receipt without replaying its token or notification", async () => {
    const dependencies = setup();
    const event = lifecycleEvent(
      "processing",
      "11111111-1111-4111-8111-111111111111",
    );
    await dependencies.service.handle("processing", event);
    await dependencies.service.handle("processing", event);
    expect(dependencies.internalTokens.verify).toHaveBeenCalledTimes(1);
    expect(dependencies.realtime.emitToRoom).toHaveBeenCalledTimes(1);
  });

  it("rejects state regressions and makes duplicate states harmless", async () => {
    const dependencies = setup();
    dependencies.source.status = SourceStatus.INDEXED;
    dependencies.version.processingStatus = SourceProcessingStatus.INDEXED;
    await dependencies.service.handle(
      "processing",
      lifecycleEvent("processing", "11111111-1111-4111-8111-111111111112"),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.INDEXED,
    );
    expect(dependencies.realtime.emitToRoom).not.toHaveBeenCalled();
  });

  it("allows failure from an active state and rejects a later extracted event", async () => {
    const dependencies = setup();
    await dependencies.service.handle(
      "failed",
      lifecycleEvent("failed", "11111111-1111-4111-8111-111111111113", {
        errorCode: "MINIO_MISSING",
        errorMessage: "Object was not found",
      }),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.FAILED,
    );
    expect(dependencies.version.failureCode).toBe("MINIO_MISSING");
    await dependencies.service.handle(
      "extracted",
      lifecycleEvent("extracted", "11111111-1111-4111-8111-111111111114"),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.FAILED,
    );
    expect(dependencies.realtime.emitToRoom).toHaveBeenCalledTimes(1);
  });

  it("drops a tenant-mismatched event without persistence or notification", async () => {
    const dependencies = setup();
    dependencies.internalTokens.verify.mockResolvedValueOnce({
      jti: "11111111-1111-4111-8111-111111111115",
      service: "document-worker",
      organizationId: "99999999-9999-4999-8999-999999999999",
      workspaceId,
      correlationId: "55555555-5555-4555-8555-555555555555",
      allowedActions: ["source.processing"],
    });
    await dependencies.service.handle(
      "processing",
      lifecycleEvent(
        "processing",
        "11111111-1111-4111-8111-111111111115",
        {},
        { organizationId: "99999999-9999-4999-8999-999999999999" },
      ),
    );
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.PENDING,
    );
    expect(dependencies.realtime.emitToRoom).not.toHaveBeenCalled();
  });

  it("rejects a token whose authorized action does not match the lifecycle event", async () => {
    const dependencies = setup();
    dependencies.internalTokens.verify.mockResolvedValueOnce({
      jti: "11111111-1111-4111-8111-111111111116",
      service: "document-worker",
      organizationId,
      workspaceId,
      correlationId: "55555555-5555-4555-8555-555555555555",
      allowedActions: ["source.indexed"],
    });
    await expect(
      dependencies.service.handle(
        "processing",
        lifecycleEvent("processing", "11111111-1111-4111-8111-111111111116"),
      ),
    ).rejects.toThrow("authorization mismatch");
    expect(dependencies.manager.save).not.toHaveBeenCalled();
  });

  it("retries a forward event until its prerequisite transitions persist", async () => {
    const dependencies = setup();
    const indexed = lifecycleEvent(
      "indexed",
      "11111111-1111-4111-8111-111111111117",
    );

    await expect(
      dependencies.service.handle("indexed", indexed),
    ).rejects.toThrow("before its prerequisite");
    expect(
      dependencies.receiptMap.has("11111111-1111-4111-8111-111111111117"),
    ).toBe(false);
    await dependencies.service.handle(
      "processing",
      lifecycleEvent("processing", "11111111-1111-4111-8111-111111111118"),
    );
    await dependencies.service.handle(
      "extracted",
      lifecycleEvent("extracted", "11111111-1111-4111-8111-111111111119"),
    );
    await expect(
      dependencies.service.handle("indexed", indexed),
    ).resolves.toBeUndefined();
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.INDEXED,
    );
  });

  it("can retry the same signed event after a transient database failure", async () => {
    const dependencies = setup();
    const event = lifecycleEvent(
      "processing",
      "11111111-1111-4111-8111-111111111120",
    );
    dependencies.dataSource.transaction.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(
      dependencies.service.handle("processing", event),
    ).rejects.toThrow("database unavailable");
    await expect(
      dependencies.service.handle("processing", event),
    ).resolves.toBeUndefined();
    expect(dependencies.internalTokens.verify).toHaveBeenCalledTimes(2);
    expect(dependencies.version.processingStatus).toBe(
      SourceProcessingStatus.PROCESSING,
    );
  });

  it("rejects a malformed lifecycle payload before authentication or persistence", async () => {
    const dependencies = setup();
    const event = lifecycleEvent(
      "processing",
      "11111111-1111-4111-8111-111111111121",
      { chunkCount: -1 },
    );

    await expect(
      dependencies.service.handle("processing", event),
    ).rejects.toThrow("chunkCount");
    expect(dependencies.internalTokens.verify).not.toHaveBeenCalled();
    expect(dependencies.manager.save).not.toHaveBeenCalled();
  });

  it("rejects unknown callback fields so tokens or secrets cannot reach realtime", async () => {
    const dependencies = setup();
    const event = lifecycleEvent(
      "processing",
      "11111111-1111-4111-8111-111111111122",
      { unexpectedSecret: "must-not-be-forwarded" },
    );

    await expect(
      dependencies.service.handle("processing", event),
    ).rejects.toThrow("unknown field");
    expect(dependencies.internalTokens.verify).not.toHaveBeenCalled();
    expect(dependencies.realtime.emitToRoom).not.toHaveBeenCalled();
  });
});
