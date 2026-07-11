import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ActorType } from '../../database/enums';
import { AuditService } from '../audit/audit.service';
import { validateApplicationSchema } from './schema-validator';
import {
  Application,
  ApplicationStatus,
} from './entities/application.entity';
import { ApplicationVersion } from './entities/application-version.entity';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationFilterDto,
  SaveDraftSchemaDto,
  CreateApplicationVersionDto,
  DuplicateApplicationDto,
} from './dto/application.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(ApplicationVersion)
    private readonly versionRepository: Repository<ApplicationVersion>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateApplicationDto, orgId: string, ownerId: string): Promise<Application> {
    const existing = await this.applicationRepository.findOne({
      where: { name: dto.name, orgId, projectId: dto.projectId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'APPLICATION_NAME_EXISTS',
        message: `Application with name "${dto.name}" already exists in this project`,
      });
    }

    const application = this.applicationRepository.create({
      id: uuidv4(),
      name: dto.name,
      description: dto.description ?? null,
      orgId,
      ownerId,
      projectId: dto.projectId,
      status: ApplicationStatus.DRAFT,
      currentVersion: 0,
      schemaRevision: 1,
    });

    const saved = await this.applicationRepository.save(application);

    await this.auditService.log({
      elementId: saved.id,
      actorId: ownerId,
      actorType: ActorType.USER,
      eventType: 'APPLICATION_CREATED',
      beforeState: null,
      afterState: { name: saved.name, orgId: saved.orgId, projectId: saved.projectId },
    });

    return saved;
  }

  async findAll(filter: ApplicationFilterDto, orgId: string): Promise<{ applications: Application[]; total: number }> {
    const { search, projectId, page = 1, limit = 20 } = filter;

    const query = this.applicationRepository
      .createQueryBuilder('app')
      .where('app.orgId = :orgId', { orgId });

    if (projectId) {
      query.andWhere('app.projectId = :projectId', { projectId });
    }

    if (search) {
      query.andWhere('app.name ILIKE :search', { search: `%${search}%` });
    }

    const total = await query.getCount();

    const applications = await query
      .orderBy('app.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { applications, total };
  }

  async findOne(id: string, orgId: string): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id, orgId },
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    return application;
  }

  async update(
    id: string,
    dto: UpdateApplicationDto,
    orgId: string,
    actorId: string,
  ): Promise<Application> {
    const application = await this.findOne(id, orgId);

    if (application.status === ApplicationStatus.ARCHIVED) {
      throw new BadRequestException('Cannot modify an archived application');
    }

    const beforeState = { name: application.name, description: application.description };

    if (dto.name !== undefined) application.name = dto.name;
    if (dto.description !== undefined) application.description = dto.description;

    const saved = await this.applicationRepository.save(application);

    await this.auditService.log({
      elementId: id,
      actorId,
      actorType: ActorType.USER,
      eventType: 'APPLICATION_UPDATED',
      beforeState,
      afterState: { name: saved.name, description: saved.description },
    });

    return saved;
  }

  async saveDraftSchema(
    id: string,
    dto: SaveDraftSchemaDto,
    orgId: string,
    actorId: string,
  ): Promise<{ application: Application; revision: number }> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(Application, {
        where: { id, orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      if (application.status === ApplicationStatus.ARCHIVED) {
        throw new BadRequestException('Cannot modify an archived application');
      }

      // Optimistic concurrency check
      if (dto.expectedRevision !== undefined && application.schemaRevision !== dto.expectedRevision) {
        throw new ConflictException({
          code: 'APPLICATION_SCHEMA_REVISION_CONFLICT',
          message: `Schema revision conflict: stored=${application.schemaRevision}, expected=${dto.expectedRevision}`,
          storedRevision: application.schemaRevision,
          expectedRevision: dto.expectedRevision,
        });
      }

      const schemaVersion = dto.schemaVersion ?? '1.0.0';
      const schema = {
        schemaVersion,
        metadata: {
          applicationId: id,
          name: application.name,
        },
        ...dto.schema,
      };

      const validation = validateApplicationSchema(schema);
      if (!validation.valid) {
        throw new BadRequestException({
          code: 'INVALID_SCHEMA',
          message: 'Application schema validation failed',
          errors: validation.errors.map((e) => ({
            code: e.code,
            path: e.path,
            message: e.message,
            severity: e.severity,
          })),
        });
      }

      application.draftSchema = schema;
      application.schemaRevision += 1;
      const saved = await manager.save(application);

      return { application: saved, revision: saved.schemaRevision };
    });
  }

  async createVersion(
    id: string,
    dto: CreateApplicationVersionDto,
    orgId: string,
    actorId: string,
  ): Promise<ApplicationVersion> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(Application, {
        where: { id, orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      if (application.status === ApplicationStatus.ARCHIVED) {
        throw new BadRequestException('Cannot create version for archived application');
      }

      const schema = {
        schemaVersion: dto.schemaVersion,
        metadata: {
          applicationId: id,
          name: application.name,
        },
        ...dto.schema,
      };

      const validation = validateApplicationSchema(schema);
      if (!validation.valid) {
        throw new BadRequestException({
          code: 'INVALID_SCHEMA',
          message: 'Application schema validation failed',
          errors: validation.errors.map((e) => ({
            code: e.code,
            path: e.path,
            message: e.message,
            severity: e.severity,
          })),
        });
      }

      const versionNumber = application.currentVersion + 1;

      const version = manager.create(ApplicationVersion, {
        applicationId: id,
        versionNumber,
        schemaVersion: dto.schemaVersion,
        schema,
        description: dto.description ?? null,
        isPublished: false,
        createdBy: actorId,
      });

      const saved = await manager.save(version);

      await manager.update(Application, id, {
        currentVersion: versionNumber,
        draftSchema: schema,
      });

      await this.auditService.log({
        elementId: id,
        actorId,
        actorType: ActorType.USER,
        eventType: 'APPLICATION_VERSION_CREATED',
        beforeState: { currentVersion: application.currentVersion },
        afterState: { currentVersion: versionNumber, versionId: saved.id },
      });

      return saved;
    });
  }

  async publishVersion(
    id: string,
    versionId: string,
    orgId: string,
    actorId: string,
  ): Promise<ApplicationVersion> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(Application, {
        where: { id, orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      if (application.status === ApplicationStatus.ARCHIVED) {
        throw new BadRequestException('Cannot publish an archived application');
      }

      const version = await manager.findOne(ApplicationVersion, {
        where: { id: versionId, applicationId: id },
      });

      if (!version) {
        throw new NotFoundException(`Version ${versionId} not found for application ${id}`);
      }

      if (version.isPublished) {
        throw new ConflictException({
          code: 'VERSION_ALREADY_PUBLISHED',
          message: `Version ${version.versionNumber} is already published`,
        });
      }

      version.isPublished = true;
      version.publishedAt = new Date();
      version.publishedBy = actorId;

      const saved = await manager.save(version);

      application.publishedVersionId = saved.id;
      application.status = ApplicationStatus.PUBLISHED;
      await manager.save(application);

      await this.auditService.log({
        elementId: id,
        actorId,
        actorType: ActorType.USER,
        eventType: 'APPLICATION_PUBLISHED',
        beforeState: { publishedVersionId: application.publishedVersionId },
        afterState: { publishedVersionId: saved.id, versionNumber: version.versionNumber },
      });

      return saved;
    });
  }

  async unpublishVersion(
    id: string,
    orgId: string,
    actorId: string,
  ): Promise<Application> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(Application, {
        where: { id, orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      if (application.status === ApplicationStatus.ARCHIVED) {
        throw new BadRequestException('Cannot unpublish an archived application');
      }

      if (!application.publishedVersionId) {
        throw new BadRequestException({
          code: 'NOT_PUBLISHED',
          message: 'Application is not published',
        });
      }

      const oldVersion = await manager.findOne(ApplicationVersion, {
        where: { id: application.publishedVersionId },
      });
      if (oldVersion) {
        oldVersion.isPublished = false;
        await manager.save(oldVersion);
      }

      application.publishedVersionId = null;
      application.status = ApplicationStatus.DRAFT;
      const saved = await manager.save(application);

      await this.auditService.log({
        elementId: id,
        actorId,
        actorType: ActorType.USER,
        eventType: 'APPLICATION_UNPUBLISHED',
        beforeState: { publishedVersionId: application.publishedVersionId },
        afterState: { status: ApplicationStatus.DRAFT },
      });

      return saved;
    });
  }

  async getPublishedVersion(id: string, orgId: string): Promise<ApplicationVersion> {
    const application = await this.findOne(id, orgId);

    if (!application.publishedVersionId) {
      throw new NotFoundException(`No published version found for application ${id}`);
    }

    const version = await this.versionRepository.findOne({
      where: { id: application.publishedVersionId },
    });

    if (!version) {
      throw new NotFoundException(`Published version ${application.publishedVersionId} not found`);
    }

    return version;
  }

  async findVersions(id: string, orgId: string): Promise<ApplicationVersion[]> {
    await this.findOne(id, orgId);

    return this.versionRepository.find({
      where: { applicationId: id },
      order: { versionNumber: 'DESC' },
    });
  }

  async findVersion(
    id: string,
    versionId: string,
    orgId: string,
  ): Promise<ApplicationVersion> {
    await this.findOne(id, orgId);

    const version = await this.versionRepository.findOne({
      where: { id: versionId, applicationId: id },
    });

    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found`);
    }

    return version;
  }

  async duplicate(
    id: string,
    dto: DuplicateApplicationDto,
    orgId: string,
    actorId: string,
  ): Promise<Application> {
    return this.dataSource.transaction(async (manager) => {
      const original = await manager.findOne(Application, {
        where: { id, orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!original) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      if (original.status === ApplicationStatus.ARCHIVED) {
        throw new BadRequestException('Cannot duplicate an archived application');
      }

      const existing = await manager.findOne(Application, {
        where: { name: dto.name, orgId, projectId: original.projectId },
      });
      if (existing) {
        throw new ConflictException({
          code: 'APPLICATION_NAME_EXISTS',
          message: `Application with name "${dto.name}" already exists`,
        });
      }

      const duplicate = manager.create(Application, {
        id: uuidv4(),
        name: dto.name,
        description: dto.description ?? original.description,
        orgId,
        ownerId: actorId,
        projectId: original.projectId,
        status: ApplicationStatus.DRAFT,
        currentVersion: 0,
        schemaRevision: 1,
        draftSchema: original.draftSchema,
      });

      const saved = await manager.save(duplicate);

      if (original.publishedVersionId) {
        const publishedVersion = await manager.findOne(ApplicationVersion, {
          where: { id: original.publishedVersionId },
        });

        if (publishedVersion) {
          const versionCopy = manager.create(ApplicationVersion, {
            applicationId: saved.id,
            versionNumber: 1,
            schemaVersion: publishedVersion.schemaVersion,
            schema: publishedVersion.schema,
            description: `Duplicated from ${original.name} v${publishedVersion.versionNumber}`,
            isPublished: false,
            createdBy: actorId,
          });
          await manager.save(versionCopy);
          saved.currentVersion = 1;
          await manager.save(saved);
        }
      }

      await this.auditService.log({
        elementId: saved.id,
        actorId,
        actorType: ActorType.USER,
        eventType: 'APPLICATION_DUPLICATED',
        beforeState: null,
        afterState: {
          name: saved.name,
          originalId: id,
          orgId: saved.orgId,
          projectId: saved.projectId,
        },
      });

      return saved;
    });
  }

  async archive(id: string, orgId: string, actorId: string): Promise<void> {
    const application = await this.findOne(id, orgId);

    const beforeState = { status: application.status };

    application.status = ApplicationStatus.ARCHIVED;
    await this.applicationRepository.save(application);

    await this.auditService.log({
      elementId: id,
      actorId,
      actorType: ActorType.USER,
      eventType: 'APPLICATION_ARCHIVED',
      beforeState,
      afterState: { status: ApplicationStatus.ARCHIVED },
    });
  }
}
