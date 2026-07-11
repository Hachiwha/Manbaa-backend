import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as request from "supertest";

import { SourcesController } from "./sources.controller";
import { SourcesService } from "./sources.service";

describe("SourcesController multipart integration", () => {
  let app: INestApplication;
  const sources = { upload: jest.fn() };
  const workspaceId = "33333333-3333-4333-8333-333333333333";
  const projectId = "44444444-4444-4444-8444-444444444444";
  const user = {
    id: "66666666-6666-4666-8666-666666666666",
    orgId: "22222222-2222-4222-8222-222222222222",
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [{ provide: SourcesService, useValue: sources }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.use((req: { user?: typeof user }, _res: unknown, next: () => void) => {
      req.user = user;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => app.close());

  it("accepts a workspace-scoped multipart source upload", async () => {
    sources.upload.mockResolvedValue({
      sourceId: "77777777-7777-4777-8777-777777777777",
      sourceVersionId: "88888888-8888-4888-8888-888888888888",
      versionNumber: 1,
      status: "pending",
      filename: "brief.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      checksumSha256:
        "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
      createdAt: "2026-07-10T12:00:00.000Z",
    });

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/sources`)
      .field("projectId", projectId)
      .attach("file", Buffer.from("hello world\n"), "brief.txt")
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            versionNumber: 1,
            status: "pending",
            checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
            createdAt: expect.any(String),
          }),
        );
      });

    expect(sources.upload).toHaveBeenCalledWith(
      workspaceId,
      { projectId },
      expect.objectContaining({
        originalname: "brief.txt",
        size: 12,
        buffer: Buffer.from("hello world\n"),
      }),
      user,
    );
  });

  it("returns 403 when workspace source permissions deny the caller", async () => {
    sources.upload.mockRejectedValueOnce(
      new ForbiddenException("Workspace access denied"),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/sources`)
      .attach("file", Buffer.from("hello world\n"), "brief.txt")
      .expect(403);
  });

  it("rejects an invalid project identifier before service execution", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/sources`)
      .field("projectId", "not-a-uuid")
      .attach("file", Buffer.from("hello world\n"), "brief.txt")
      .expect(400);
    expect(sources.upload).not.toHaveBeenCalled();
  });

  it("registers the source upload Swagger route exactly once", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("test").build(),
    );
    expect(
      Object.keys(document.paths).filter(
        (path) => path === "/api/v1/workspaces/{workspaceId}/sources",
      ),
    ).toHaveLength(1);
    expect(
      document.paths["/api/v1/workspaces/{workspaceId}/sources"]?.post
        ?.responses,
    ).toHaveProperty("201");
  });
});
