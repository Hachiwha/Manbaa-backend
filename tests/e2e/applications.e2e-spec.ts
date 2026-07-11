import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { ApplicationsController } from '../../src/modules/applications/applications.controller';
import { ApplicationsService } from '../../src/modules/applications/applications.service';

describe('Applications HTTP API', () => {
  let app: INestApplication;
  const applications = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    saveDraftSchema: jest.fn(),
    createVersion: jest.fn(),
    findVersions: jest.fn(),
    findVersion: jest.fn(),
    publishVersion: jest.fn(),
    unpublishVersion: jest.fn(),
    getPublishedVersion: jest.fn(),
    duplicate: jest.fn(),
    archive: jest.fn(),
  };
  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const appId = '550e8400-e29b-41d4-a716-446655440001';
  const versionId = '550e8400-e29b-41d4-a716-446655440002';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: applications },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: 'user-1', orgId: 'org-1', role: 'admin' };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects/:projectId/applications', () => {
    it('creates an application', async () => {
      applications.create.mockResolvedValue({ id: appId, name: 'Test App', projectId });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications`)
        .send({ name: 'Test App', projectId })
        .expect(201)
        .expect(({ body }) => {
          expect(body.application.name).toBe('Test App');
        });

      expect(applications.create).toHaveBeenCalledWith(
        { name: 'Test App', projectId },
        'org-1',
        'user-1',
      );
    });

    it('rejects missing name', async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/projects/:projectId/applications', () => {
    it('lists applications', async () => {
      applications.findAll.mockResolvedValue({ applications: [{ id: appId, name: 'Test' }], total: 1 });

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/applications`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.applications).toHaveLength(1);
          expect(body.total).toBe(1);
        });
    });
  });

  describe('GET /api/projects/:projectId/applications/:id', () => {
    it('gets application by id', async () => {
      applications.findOne.mockResolvedValue({ id: appId, name: 'Test', status: 'draft' });

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/applications/${appId}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.application.id).toBe(appId);
        });
    });
  });

  describe('PATCH /api/projects/:projectId/applications/:id', () => {
    it('updates application metadata', async () => {
      applications.update.mockResolvedValue({ id: appId, name: 'Updated', description: 'Desc' });

      await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/applications/${appId}`)
        .send({ name: 'Updated', description: 'Desc' })
        .expect(200);
    });
  });

  describe('POST /api/projects/:projectId/applications/:id/schema', () => {
    it('saves a valid schema', async () => {
      applications.saveDraftSchema.mockResolvedValue({
        application: { id: appId, draftSchema: { schemaVersion: '1.0.0' } },
        revision: 2,
      });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/schema`)
        .send({ schema: { pages: [] }, expectedRevision: 1 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.revision).toBe(2);
        });
    });

    it('saves schema without expectedRevision', async () => {
      applications.saveDraftSchema.mockResolvedValue({
        application: { id: appId, draftSchema: { pages: [] } },
        revision: 1,
      });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/schema`)
        .send({ schema: { pages: [] } })
        .expect(200);
    });
  });

  describe('POST /api/projects/:projectId/applications/:id/versions', () => {
    it('creates a version', async () => {
      applications.createVersion.mockResolvedValue({ id: versionId, versionNumber: 1 });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/versions`)
        .send({ schemaVersion: '1.0.0', schema: { pages: [] } })
        .expect(201)
        .expect(({ body }) => {
          expect(body.version.versionNumber).toBe(1);
        });
    });
  });

  describe('GET /api/projects/:projectId/applications/:id/versions', () => {
    it('lists versions', async () => {
      applications.findVersions.mockResolvedValue([{ id: versionId, versionNumber: 1 }]);

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/applications/${appId}/versions`)
        .expect(200);
    });
  });

  describe('GET /api/projects/:projectId/applications/:id/versions/:versionId', () => {
    it('gets a specific version', async () => {
      applications.findVersion.mockResolvedValue({ id: versionId, versionNumber: 1 });

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/applications/${appId}/versions/${versionId}`)
        .expect(200);
    });
  });

  describe('POST /api/projects/:projectId/applications/:id/publish', () => {
    it('publishes a version', async () => {
      applications.publishVersion.mockResolvedValue({ id: versionId, versionNumber: 1, isPublished: true });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/publish`)
        .send({ versionId })
        .expect(200)
        .expect(({ body }) => {
          expect(body.version.isPublished).toBe(true);
        });
    });
  });

  describe('GET /api/projects/:projectId/applications/:id/published', () => {
    it('gets published version', async () => {
      applications.getPublishedVersion.mockResolvedValue({ id: versionId, versionNumber: 1, isPublished: true });

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/applications/${appId}/published`)
        .expect(200);
    });
  });

  describe('POST /api/projects/:projectId/applications/:id/duplicate', () => {
    it('duplicates an application', async () => {
      applications.duplicate.mockResolvedValue({ id: appId, name: 'Copy', status: 'draft' });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/duplicate`)
        .send({ name: 'Copy' })
        .expect(201);
    });
  });

  describe('DELETE /api/projects/:projectId/applications/:id', () => {
    it('archives an application', async () => {
      applications.archive.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/projects/${projectId}/applications/${appId}`)
        .expect(204);
    });
  });

  describe('POST /api/projects/:projectId/applications/:id/unpublish', () => {
    it('unpublishes an application', async () => {
      applications.unpublishVersion.mockResolvedValue({ id: appId, status: 'draft' });

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/applications/${appId}/unpublish`)
        .expect(200);
    });
  });
});
