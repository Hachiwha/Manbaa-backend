import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import * as request from "supertest";
import { DataSource } from "typeorm";

import { RequestContextService } from "../../src/core/context/request-context.service";
import { WorkspaceStorageService } from "../../src/infra/storage/workspace-storage.service";
import { OrganizationMember } from "../../src/modules/organizations/entities/organization-member.entity";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import { Project } from "../../src/modules/projects/entities/project.entity";
import { SourceVersion } from "../../src/modules/sources/entities";
import { SourcesController } from "../../src/modules/sources/sources.controller";
import { SourcesService } from "../../src/modules/sources/sources.service";
import {
  WorkspaceMember,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from "../../src/modules/workspaces/entities/workspace-member.entity";
import { WorkspacePermissionService } from "../../src/modules/workspaces/workspace-permission.service";

jest.mock("../../src/modules/documents/utils/document-validation.util", () => ({
  ...jest.requireActual(
    "../../src/modules/documents/utils/document-validation.util",
  ),
  validateDocumentMimeType: jest.fn().mockResolvedValue("text/plain"),
}));

describe("workspace source upload HTTP integration", () => {
  let app: INestApplication;
  const organizationId = "22222222-2222-4222-8222-222222222222";
  const workspaceId = "33333333-3333-4333-8333-333333333333";
  const correlationId = "55555555-5555-4555-8555-555555555555";
  const roles = new Map<string, WorkspaceRole>([
    ["owner", WorkspaceRole.OWNER],
    ["admin", WorkspaceRole.ADMIN],
    ["editor", WorkspaceRole.EDITOR],
    ["commenter", WorkspaceRole.COMMENTER],
    ["viewer", WorkspaceRole.VIEWER],
  ]);

  beforeAll(async () => {
    const manager = {
      create: jest.fn((entity, value) => Object.assign(new entity(), value)),
      save: jest.fn(async (value) => {
        if (value instanceof SourceVersion && !value.createdAt) {
          value.createdAt = new Date("2026-07-10T12:00:00Z");
        }
        return value;
      }),
    };
    const workspaceMembers = {
      findOne: jest.fn(({ where }) => {
        const role = roles.get(where.userId);
        return Promise.resolve(
          role && where.role._value.includes(role)
            ? {
                userId: where.userId,
                organizationId,
                workspaceId,
                status: WorkspaceMemberStatus.ACTIVE,
                role,
              }
            : null,
        );
      }),
    };
    const organizationMembers = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(
          roles.has(where.userId) && where.organizationId === organizationId
            ? { userId: where.userId, organizationId, active: true }
            : null,
        ),
      ),
    };
    const storage = {
      buildSourceObjectPath: (
        context: { organizationId: string; workspaceId: string },
        sourceId: string,
        sourceVersionId: string,
        filename: string,
      ) =>
        `organizations/${context.organizationId}/workspaces/${context.workspaceId}/sources/${sourceId}/versions/${sourceVersionId}/${filename}`,
      storeSource: jest.fn(
        async (_context: unknown, key: string, content: Buffer) => ({
          bucket: "workspace-sources",
          key,
          checksumSha256: createHash("sha256").update(content).digest("hex"),
        }),
      ),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [
        SourcesService,
        WorkspacePermissionService,
        OutboxService,
        {
          provide: getRepositoryToken(Project),
          useValue: { exist: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: workspaceMembers,
        },
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: organizationMembers,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((callback) => callback(manager)),
          },
        },
        { provide: WorkspaceStorageService, useValue: storage },
        {
          provide: RequestContextService,
          useValue: { getCorrelationId: () => correlationId },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api", {
      exclude: [{ path: "health", method: RequestMethod.GET }],
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token || !roles.has(token)) {
        res.status(401).json({ statusCode: 401, message: "Unauthorized" });
        return;
      }
      (req as Request & { user: { id: string; orgId: string } }).user = {
        id: token,
        orgId: organizationId,
      };
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

  afterAll(() => app.close());

  it("returns 201 and the typed canonical response for an Editor", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/sources`)
      .set("Authorization", "Bearer editor")
      .attach("file", Buffer.from("hello world\n"), "brief.txt")
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          sourceId: expect.any(String),
          sourceVersionId: expect.any(String),
          versionNumber: 1,
          status: "pending",
          filename: "brief.txt",
          mimeType: "text/plain",
          sizeBytes: 12,
          checksumSha256:
            "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
          createdAt: "2026-07-10T12:00:00.000Z",
        });
      });
  });

  it.each(["commenter", "viewer"])(
    "returns 403 for a %s workspace member",
    async (role) => {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/sources`)
        .set("Authorization", `Bearer ${role}`)
        .attach("file", Buffer.from("hello world\n"), "brief.txt")
        .expect(403);
    },
  );

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/sources`)
      .attach("file", Buffer.from("hello world\n"), "brief.txt")
      .expect(401);
  });

  it("registers one prefixed Swagger operation", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("source-e2e").build(),
    );
    const route = "/api/v1/workspaces/{workspaceId}/sources";
    expect(
      Object.keys(document.paths).filter((path) => path === route),
    ).toHaveLength(1);
    expect(document.paths[route]?.post?.responses).toHaveProperty("201");
  });
});
