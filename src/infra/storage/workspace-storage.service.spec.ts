import { BadRequestException, ForbiddenException } from "@nestjs/common";

import {
  WORKSPACE_BUCKETS,
  WorkspaceStorageService,
} from "./workspace-storage.service";

describe("WorkspaceStorageService path security", () => {
  const config = {
    getOrThrow: (key: string) =>
      key.endsWith("port") ? 9000 : key.endsWith("useSsl") ? false : "x",
    get: (_key: string, fallback: string) => fallback,
  };
  const service = new WorkspaceStorageService(config as never);
  const ctx = { organizationId: "org", workspaceId: "ws" };

  it("builds canonical paths", () =>
    expect(
      service.buildWorkspaceObjectPath(ctx, "asset", "id", 1, "file.png"),
    ).toBe("org/ws/asset/id/1/file.png"));

  it("builds canonical source paths with stable source-version identity", () =>
    expect(
      service.buildSourceObjectPath(
        ctx,
        "source-id",
        "version-id",
        "brief.txt",
      ),
    ).toBe(
      "organizations/org/workspaces/ws/sources/source-id/versions/version-id/brief.txt",
    ));

  it.each([
    "../x",
    "%2e%2e/x",
    "organizations/org/workspaces/other/sources/id/versions/v/x",
    "/organizations/org/workspaces/ws/sources/id/versions/v/x",
    "organizations/org/workspaces/ws/sources/id/versions/v/..%252fsecret",
    "organizations/org/workspaces/ws/sources/id/versions/v/%25252e%25252e/secret",
    "organizations/org/workspaces/ws/sources/id/versions/v/bad\u0000name",
  ])("rejects traversal or cross-workspace key %s", (key) => {
    const fn = () =>
      service.validateWorkspaceObjectPath(ctx, WORKSPACE_BUCKETS[2], key);
    if (key.includes("workspaces/other"))
      expect(fn).toThrow(ForbiddenException);
    else expect(fn).toThrow(BadRequestException);
  });

  it("stores sources only in the source bucket with validated keys", async () => {
    const putObject = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(service, "client", {
      value: { putObject },
      configurable: true,
    });
    const key =
      "organizations/org/workspaces/ws/sources/source-id/versions/version-id/brief.txt";

    await expect(
      service.storeSource(ctx, key, Buffer.from("hello"), "text/plain"),
    ).resolves.toEqual({
      bucket: WORKSPACE_BUCKETS[0],
      key,
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(putObject).toHaveBeenCalledWith(
      WORKSPACE_BUCKETS[0],
      key,
      expect.any(Buffer),
      5,
      expect.objectContaining({ "Content-Type": "text/plain" }),
    );
  });

  it("rejects an unsafe source key before writing", async () => {
    await expect(
      service.storeSource(
        ctx,
        "organizations/org/workspaces/ws/sources/../secret.txt",
        Buffer.from("x"),
        "text/plain",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
