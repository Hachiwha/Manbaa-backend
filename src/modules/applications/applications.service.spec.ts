import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { ActorType } from '../../database/enums';
import { ApplicationsService } from './applications.service';
import { ApplicationStatus } from './entities/application.entity';

describe('ApplicationsService', () => {
  const orgId = 'org-1';
  const ownerId = 'user-1';
  const projectId = 'proj-1';

  const mockApp = (overrides = {}) => ({
    id: 'app-1',
    name: 'Test',
    description: null,
    orgId,
    ownerId,
    projectId,
    status: ApplicationStatus.DRAFT,
    currentVersion: 0,
    schemaRevision: 1,
    draftSchema: null,
    publishedVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeService = () => {
    const applicationRepository = {
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve({ ...value, id: value.id ?? 'app-1' })),
      create: jest.fn((value) => ({ ...value })),
      createQueryBuilder: jest.fn(),
    };
    const versionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      create: jest.fn((value) => ({ ...value })),
    };
    const manager: any = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn((value) => Promise.resolve({ ...value, id: value.id ?? 'ver-1' })),
      create: jest.fn((_entity, value) => ({ ...value })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const dataSource = {
      transaction: jest.fn(async (fn: (m: any) => Promise<any>) => fn(manager)),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const service = new ApplicationsService(
      applicationRepository as never,
      versionRepository as never,
      dataSource as never,
      auditService as never,
    );

    return { service, applicationRepository, versionRepository, dataSource, auditService, manager };
  };

  describe('create', () => {
    it('creates an application with org scoping', async () => {
      const { service, applicationRepository, auditService } = makeService();
      applicationRepository.findOne.mockResolvedValue(null);

      const result = await service.create({ name: 'Test App', projectId }, orgId, ownerId);

      expect(applicationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test App', orgId, ownerId, projectId, status: ApplicationStatus.DRAFT }),
      );
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        actorId: ownerId, actorType: ActorType.USER, eventType: 'APPLICATION_CREATED',
      }));
      expect(result.name).toBe('Test App');
    });

    it('rejects duplicate names within project', async () => {
      const { service, applicationRepository } = makeService();
      applicationRepository.findOne.mockResolvedValue({ id: 'existing', name: 'Test App' });
      await expect(service.create({ name: 'Test App', projectId }, orgId, ownerId)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('finds application with org scope', async () => {
      const { service, applicationRepository } = makeService();
      applicationRepository.findOne.mockResolvedValue(mockApp());
      const result = await service.findOne('app-1', orgId);
      expect(result.id).toBe('app-1');
    });

    it('throws when not found', async () => {
      const { service, applicationRepository } = makeService();
      applicationRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('app-1', orgId)).rejects.toThrow(NotFoundException);
    });

    it('enforces org isolation', async () => {
      const { service, applicationRepository } = makeService();
      applicationRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('app-1', 'other-org')).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveDraftSchema', () => {
    it('saves a valid schema and increments revision', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockResolvedValue(mockApp({ schemaRevision: 3 }));

      const result = await service.saveDraftSchema(
        'app-1',
        { schema: { pages: [{ id: 'p1', name: 'Home', route: '/', root: { id: 'c1', type: 'div', props: {}, styles: {}, bindings: {}, events: {}, children: [] } }] } },
        orgId, ownerId,
      );

      expect(result.revision).toBe(4);
      expect(result.application.draftSchema).toBeDefined();
    });

    it('rejects invalid schema', async () => {
      const { service, manager } = makeService();
      manager.findOne.mockResolvedValue(mockApp());

      await expect(
        service.saveDraftSchema('app-1', { schema: { pages: [{ id: 123 }] } }, orgId, ownerId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects archived application', async () => {
      const { service, manager } = makeService();
      manager.findOne.mockResolvedValue(mockApp({ status: ApplicationStatus.ARCHIVED }));

      await expect(
        service.saveDraftSchema('app-1', { schema: { pages: [] } }, orgId, ownerId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects stale revision with 409 conflict', async () => {
      const { service, manager } = makeService();
      manager.findOne.mockResolvedValue(mockApp({ schemaRevision: 5 }));

      await expect(
        service.saveDraftSchema('app-1', { schema: { pages: [] }, expectedRevision: 3 }, orgId, ownerId),
      ).rejects.toThrow(expect.objectContaining({
        response: expect.objectContaining({ code: 'APPLICATION_SCHEMA_REVISION_CONFLICT' }),
      }));
    });
  });

  describe('createVersion', () => {
    it('creates a version with incremented number using pessimistic lock', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockResolvedValue(mockApp({ currentVersion: 2 }));
      mgr.save.mockResolvedValue({ id: 'ver-1', versionNumber: 3 });
      mgr.update.mockResolvedValue({ affected: 1 });

      const version = await service.createVersion('app-1', { schemaVersion: '1.0.0', schema: { pages: [] } }, orgId, ownerId);

      expect(version.versionNumber).toBe(3);
      expect(mgr.findOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }));
    });
  });

  describe('publishVersion', () => {
    it('publishes a version and updates application status', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockImplementation(async (_entity, opts) => {
        if (opts?.where?.id === 'app-1') return mockApp({ currentVersion: 1, publishedVersionId: null });
        if (opts?.where?.id === 'ver-1') return { id: 'ver-1', applicationId: 'app-1', versionNumber: 1, isPublished: false };
        return null;
      });

      const version = await service.publishVersion('app-1', 'ver-1', orgId, ownerId);
      expect(version.isPublished).toBe(true);
      expect(version.publishedAt).toBeDefined();
      expect(version.publishedBy).toBe(ownerId);
    });

    it('rejects publishing already published version', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockImplementation(async (_entity, opts) => {
        if (opts?.where?.id === 'app-1') return mockApp({ currentVersion: 1 });
        if (opts?.where?.id === 'ver-1') return { id: 'ver-1', applicationId: 'app-1', versionNumber: 1, isPublished: true };
        return null;
      });

      await expect(service.publishVersion('app-1', 'ver-1', orgId, ownerId)).rejects.toThrow(ConflictException);
    });

    it('rejects publishing archived application', async () => {
      const { service, manager } = makeService();
      manager.findOne.mockResolvedValue(mockApp({ status: ApplicationStatus.ARCHIVED }));

      await expect(service.publishVersion('app-1', 'ver-1', orgId, ownerId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpublishVersion', () => {
    it('unpublishes and reverts to draft', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockImplementation(async (_entity, opts) => {
        if (opts?.where?.id === 'app-1' && opts?.lock) return mockApp({ publishedVersionId: 'ver-1' });
        if (opts?.where?.id === 'ver-1' && !opts?.lock) return { id: 'ver-1', isPublished: true };
        if (opts?.where?.id === 'app-1' && !opts?.lock) return mockApp({ publishedVersionId: 'ver-1' });
        return null;
      });

      const result = await service.unpublishVersion('app-1', orgId, ownerId);
      expect(result.status).toBe(ApplicationStatus.DRAFT);
      expect(result.publishedVersionId).toBeNull();
    });
  });

  describe('duplicate', () => {
    it('creates a duplicate application', async () => {
      const { service, manager } = makeService();
      const mgr = manager;
      mgr.findOne.mockImplementation(async (_entity, opts) => {
        if (opts?.where?.id === 'app-1') return mockApp({});
        if (opts?.where?.name === 'Test Copy') return null;
        return null;
      });

      const result = await service.duplicate('app-1', { name: 'Test Copy' }, orgId, ownerId);
      expect(result.name).toBe('Test Copy');
      expect(result.status).toBe(ApplicationStatus.DRAFT);
    });
  });

  describe('findAll', () => {
    it('returns applications with org scope', async () => {
      const { service, applicationRepository } = makeService();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockApp()]),
      };
      applicationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 20 }, orgId);
      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('archive', () => {
    it('archives an application', async () => {
      const { service, applicationRepository } = makeService();
      applicationRepository.findOne.mockResolvedValue(mockApp());
      await service.archive('app-1', orgId, ownerId);
      expect(applicationRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: ApplicationStatus.ARCHIVED }));
    });
  });
});
