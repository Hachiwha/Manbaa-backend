import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InternalServiceTokenService } from "./internal-service-token.service";
describe("InternalServiceTokenService", () => {
  const values: Record<string, unknown> = {
    "internalAuth.issuer": "nestjs",
    "internalAuth.audience": "workers",
    "internalAuth.currentSecret": "a-secure-internal-secret-with-32-characters",
    "internalAuth.allowedServices": ["ai-orchestrator"],
  };
  const config = {
    get: (k: string, d?: unknown) => values[k] ?? d,
    getOrThrow: (k: string) => values[k],
  };
  const redis = { markOnce: jest.fn().mockResolvedValue(true) };
  const service = new InternalServiceTokenService(
    new JwtService(),
    config as never,
    redis as never,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    redis.markOnce.mockResolvedValue(true);
  });
  it("creates and validates a short-lived scoped token", async () => {
    const token = await service.create({
      service: "ai-orchestrator",
      organizationId: "o",
      workspaceId: "w",
      taskId: "t",
      correlationId: "c",
      allowedActions: ["task.progress"],
    });
    await expect(service.validate(token)).resolves.toEqual(
      expect.objectContaining({
        service: "ai-orchestrator",
        workspaceId: "w",
        taskId: "t",
      }),
    );
  });
  it("verifies a retryable callback without consuming replay state", async () => {
    const token = await service.create({
      service: "ai-orchestrator",
      organizationId: "o",
      correlationId: "c",
      allowedActions: [],
    });
    await expect(service.verify(token)).resolves.toEqual(
      expect.objectContaining({ service: "ai-orchestrator" }),
    );
    expect(redis.markOnce).not.toHaveBeenCalled();
  });
  it("rejects a forged signature", async () => {
    const forged = await new JwtService().signAsync(
      { service: "ai-orchestrator" },
      {
        secret: "different-secret-that-is-at-least-32-characters",
        issuer: "nestjs",
        audience: "workers",
        expiresIn: "1m",
      },
    );
    await expect(service.validate(forged)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("rejects replayed jti", async () => {
    const token = await service.create({
      service: "ai-orchestrator",
      organizationId: "o",
      correlationId: "c",
      allowedActions: [],
    });
    redis.markOnce.mockResolvedValue(false);
    await expect(service.validate(token)).rejects.toThrow("replay");
  });
});
