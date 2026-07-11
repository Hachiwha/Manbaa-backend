import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, Repository } from "typeorm";
import { validate as validateUuid } from "uuid";

import { RequestContextService } from "../../core/context/request-context.service";
import { createSourceProcessRequestedEvent } from "../../core/messaging/events";
import { WorkspaceStorageService } from "../../infra/storage/workspace-storage.service";
import { OutboxService } from "../outbox/outbox.service";
import { Project } from "../projects/entities/project.entity";
import { WorkspacePermissionService } from "../workspaces/workspace-permission.service";
import { SourceUploadResponseDto, UploadSourceDto } from "./dto";
import {
  Source,
  SourceKind,
  SourceProcessingStatus,
  SourceStatus,
  SourceVersion,
} from "./entities";
import {
  assertSourceFileSize,
  sanitizeSourceFilename,
  validateSourceMimeType,
} from "./source-validation.util";

type RequestUser = { id: string; orgId: string };

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly permissions: WorkspacePermissionService,
    private readonly storage: WorkspaceStorageService,
    private readonly outbox: OutboxService,
    private readonly context: RequestContextService,
  ) {}

  async upload(
    workspaceId: string,
    dto: UploadSourceDto,
    file: Express.Multer.File | undefined,
    user: RequestUser,
  ): Promise<SourceUploadResponseDto> {
    await this.permissions.requireEditor(user.id, workspaceId, user.orgId);
    if (!file) {
      throw new BadRequestException(
        'A multipart file is required under the "file" field.',
      );
    }

    assertSourceFileSize(file.buffer.length);
    if (file.size !== file.buffer.length) {
      throw new BadRequestException(
        "Source file size metadata is inconsistent",
      );
    }
    const sizeBytes = file.buffer.length;
    const mimeType = await validateSourceMimeType(
      file.originalname,
      file.buffer,
    );
    const filename = sanitizeSourceFilename(file.originalname);
    if (dto.projectId) {
      const projectExists = await this.projects.exist({
        where: { id: dto.projectId, orgId: user.orgId },
      });
      if (!projectExists) throw new NotFoundException("Project not found");
    }

    const correlationId = this.context.getCorrelationId();
    if (!validateUuid(correlationId)) {
      throw new BadRequestException("Correlation ID must be a UUID");
    }

    const sourceId = randomUUID();
    const sourceVersionId = randomUUID();
    const versionNumber = 1;
    const storageContext = { organizationId: user.orgId, workspaceId };
    const storageKey = this.storage.buildSourceObjectPath(
      storageContext,
      sourceId,
      sourceVersionId,
      filename,
    );
    const stored = await this.storage.storeSource(
      storageContext,
      storageKey,
      file.buffer,
      mimeType,
    );

    try {
      if (stored.bucket !== "workspace-sources") {
        throw new BadRequestException(
          "Source storage bucket must be workspace-sources",
        );
      }
      return await this.dataSource.transaction(async (manager) => {
        const source = manager.create(Source, {
          id: sourceId,
          organizationId: user.orgId,
          workspaceId,
          projectId: dto.projectId ?? null,
          name: filename,
          kind: SourceKind.DOCUMENT,
          status: SourceStatus.PENDING,
          currentVersionId: null,
          createdBy: user.id,
          deletedAt: null,
        });
        await manager.save(source);

        const sourceVersion = manager.create(SourceVersion, {
          id: sourceVersionId,
          sourceId,
          organizationId: user.orgId,
          workspaceId,
          versionNumber,
          storageBucket: stored.bucket,
          storageKey: stored.key,
          filename,
          mimeType,
          sizeBytes,
          checksumSha256: stored.checksumSha256,
          processingStatus: SourceProcessingStatus.PENDING,
          extractedAt: null,
          indexedAt: null,
          failureCode: null,
          failureMessage: null,
          createdBy: user.id,
        });
        const savedVersion = await manager.save(sourceVersion);
        source.currentVersionId = sourceVersionId;
        await manager.save(source);

        const eventId = randomUUID();
        const event = createSourceProcessRequestedEvent({
          eventId,
          organizationId: user.orgId,
          workspaceId,
          projectId: dto.projectId ?? null,
          correlationId,
          actor: { type: "user", id: user.id },
          payload: {
            sourceId,
            sourceVersionId,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            filename,
            mimeType,
            sizeBytes,
            checksumSha256: stored.checksumSha256,
          },
        });
        await this.outbox.create(
          manager,
          {
            aggregateType: "source",
            aggregateId: sourceId,
            eventType: event.event_type,
            payload: event as unknown as Record<string, unknown>,
            correlationId,
          },
          { eventId, eventIdField: "event_id" },
        );

        return {
          sourceId,
          sourceVersionId,
          versionNumber,
          status: SourceProcessingStatus.PENDING,
          filename,
          mimeType,
          sizeBytes,
          checksumSha256: stored.checksumSha256,
          createdAt: savedVersion.createdAt.toISOString(),
        };
      });
    } catch (error) {
      try {
        await this.storage.deleteObject(
          storageContext,
          stored.bucket,
          stored.key,
        );
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to remove orphaned source object after transaction rollback: ${(cleanupError as Error).message}`,
        );
      }
      throw error;
    }
  }
}
