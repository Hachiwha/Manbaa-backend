import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { validate as validateUuid } from "uuid";

import { InternalServiceTokenService } from "../../core/internal-auth/internal-service-token.service";
import {
  assertDomainEvent,
  DomainEvent,
} from "../../core/messaging/domain-event";
import { SUBJECTS_V2 } from "../../core/messaging/subjects";
import { NatsClientService } from "../../infra/nats/nats.client";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import {
  Source,
  SourceLifecycleEvent,
  SourceProcessingStatus,
  SourceStatus,
  SourceVersion,
} from "./entities";

const LIFECYCLE_SUBJECTS = {
  processing: SUBJECTS_V2.SOURCE_PROCESSING,
  extracted: SUBJECTS_V2.SOURCE_EXTRACTED,
  indexed: SUBJECTS_V2.SOURCE_INDEXED,
  failed: SUBJECTS_V2.SOURCE_FAILED,
} as const;

type SourceLifecycleKind = keyof typeof LIFECYCLE_SUBJECTS;
type TransitionOutcome = "changed" | "ignored" | "retry";

type SourceLifecyclePayload = Record<string, unknown> & {
  sourceId: string;
  sourceVersionId: string;
  internalToken: string;
  projectId?: string | null;
  actor?: { type: "user" | "service"; id: string };
  chunkCount?: number;
  indexedCount?: number;
  deliveryCount?: number;
  errorCode?: string;
  errorMessage?: string;
};

type LifecycleScope = {
  eventId: string;
  eventType: string;
  organizationId: string;
  workspaceId: string;
  sourceId: string;
  sourceVersionId: string;
};

@Injectable()
export class SourceLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(SourceLifecycleService.name);

  constructor(
    @InjectRepository(SourceLifecycleEvent)
    private readonly receipts: Repository<SourceLifecycleEvent>,
    private readonly dataSource: DataSource,
    private readonly nats: NatsClientService,
    private readonly internalTokens: InternalServiceTokenService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const kind of Object.keys(
      LIFECYCLE_SUBJECTS,
    ) as SourceLifecycleKind[]) {
      await this.nats.subscribeDurable({
        subject: LIFECYCLE_SUBJECTS[kind],
        durableName: `nestjs-source-${kind}`,
        handler: (value) => this.handle(kind, value),
      });
    }
  }

  async handle(
    kind: SourceLifecycleKind,
    value: Record<string, unknown>,
  ): Promise<void> {
    assertDomainEvent(value);
    const event = value as unknown as DomainEvent<SourceLifecyclePayload>;
    const expectedType = LIFECYCLE_SUBJECTS[kind];
    if (event.eventType !== expectedType)
      throw new Error("Source lifecycle event type mismatch");
    if (!event.workspaceId)
      throw new Error("Source lifecycle event requires workspace scope");
    this.assertUuid(event.eventId, "eventId");
    this.assertUuid(event.organizationId, "organizationId");
    this.assertUuid(event.workspaceId, "workspaceId");
    this.assertUuid(event.payload.sourceId, "sourceId");
    this.assertUuid(event.payload.sourceVersionId, "sourceVersionId");
    this.assertPayload(event.payload);

    const scope: LifecycleScope = {
      eventId: event.eventId,
      eventType: event.eventType,
      organizationId: event.organizationId,
      workspaceId: event.workspaceId,
      sourceId: event.payload.sourceId,
      sourceVersionId: event.payload.sourceVersionId,
    };
    const existing = await this.receipts.findOne({
      where: { eventId: event.eventId },
    });
    if (existing) {
      this.assertReceiptScope(existing, scope);
      return;
    }

    const claims = await this.internalTokens.verify(
      event.payload.internalToken,
      "nestjs-platform",
    );
    if (
      claims.service !== "document-worker" ||
      claims.organizationId !== event.organizationId ||
      claims.workspaceId !== event.workspaceId ||
      claims.correlationId !== event.correlationId ||
      !claims.allowedActions.includes(`source.${kind}`)
    ) {
      throw new Error("Source lifecycle event authorization mismatch");
    }
    if (
      typeof claims.jti !== "string" ||
      !claims.jti ||
      claims.jti.length > 255
    ) {
      throw new Error("Source lifecycle token jti is invalid");
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const racedReceipt = await manager.findOne(SourceLifecycleEvent, {
        where: { eventId: event.eventId },
        lock: { mode: "pessimistic_write" },
      });
      if (racedReceipt) {
        this.assertReceiptScope(racedReceipt, scope);
        return { changed: false, source: null as Source | null };
      }

      const source = await manager.findOne(Source, {
        where: {
          id: event.payload.sourceId,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          deletedAt: IsNull(),
        },
        lock: { mode: "pessimistic_write" },
      });
      const version = await manager.findOne(SourceVersion, {
        where: {
          id: event.payload.sourceVersionId,
          sourceId: event.payload.sourceId,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!source || !version) {
        this.logger.warn(
          `Dropping out-of-scope source lifecycle event ${event.eventId}`,
        );
        return { changed: false, source: null as Source | null };
      }

      const transition = this.applyTransition(kind, source, version, event);
      if (transition === "retry") {
        throw new Error(
          "Source lifecycle event arrived before its prerequisite",
        );
      }
      await manager.save(
        manager.create(SourceLifecycleEvent, {
          eventId: event.eventId,
          eventType: event.eventType,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          sourceId: event.payload.sourceId,
          sourceVersionId: event.payload.sourceVersionId,
          tokenJti: claims.jti,
        }),
      );
      const changed = transition === "changed";
      if (changed) {
        await manager.save(version);
        await manager.save(source);
      }
      return { changed, source };
    });

    if (!outcome.changed || !outcome.source) return;
    const { internalToken: _internalToken, ...safePayload } = event.payload;
    const notification = {
      ...safePayload,
      status: kind,
      correlationId: event.correlationId,
    };
    this.realtime.emitToRoom(
      `workspace:${event.workspaceId}`,
      `source.${kind}`,
      notification,
    );
    this.realtime.emitToUser(
      outcome.source.createdBy,
      `source.${kind}`,
      notification,
    );
  }

  private applyTransition(
    kind: SourceLifecycleKind,
    source: Source,
    version: SourceVersion,
    event: DomainEvent<SourceLifecyclePayload>,
  ): TransitionOutcome {
    if (source.currentVersionId !== version.id) return "ignored";
    const current = version.processingStatus;
    const desired = this.statusFor(kind);
    if (current === desired) return "ignored";

    if (kind === "failed") {
      if (
        current === SourceProcessingStatus.FAILED ||
        current === SourceProcessingStatus.INDEXED
      ) {
        return "ignored";
      }
    } else {
      if (current === SourceProcessingStatus.FAILED) return "ignored";
      const order: SourceProcessingStatus[] = [
        SourceProcessingStatus.PENDING,
        SourceProcessingStatus.PROCESSING,
        SourceProcessingStatus.EXTRACTED,
        SourceProcessingStatus.INDEXED,
      ];
      const currentIndex = order.indexOf(current);
      const desiredIndex = order.indexOf(desired);
      if (desiredIndex < currentIndex) return "ignored";
      if (desiredIndex > currentIndex + 1) return "retry";
    }

    version.processingStatus = desired;
    source.status = this.sourceStatusFor(kind);
    if (kind === "extracted") version.extractedAt = new Date(event.timestamp);
    if (kind === "indexed") version.indexedAt = new Date(event.timestamp);
    if (kind === "failed") {
      version.failureCode = (
        event.payload.errorCode ?? "SOURCE_PROCESSING_FAILED"
      ).slice(0, 100);
      version.failureMessage = (
        event.payload.errorMessage ?? "Source processing failed"
      ).slice(0, 1000);
    }
    return "changed";
  }

  private statusFor(kind: SourceLifecycleKind): SourceProcessingStatus {
    return {
      processing: SourceProcessingStatus.PROCESSING,
      extracted: SourceProcessingStatus.EXTRACTED,
      indexed: SourceProcessingStatus.INDEXED,
      failed: SourceProcessingStatus.FAILED,
    }[kind];
  }

  private sourceStatusFor(kind: SourceLifecycleKind): SourceStatus {
    return {
      processing: SourceStatus.PROCESSING,
      extracted: SourceStatus.EXTRACTED,
      indexed: SourceStatus.INDEXED,
      failed: SourceStatus.FAILED,
    }[kind];
  }

  private assertReceiptScope(
    receipt: SourceLifecycleEvent,
    scope: LifecycleScope,
  ): void {
    if (
      receipt.eventType !== scope.eventType ||
      receipt.organizationId !== scope.organizationId ||
      receipt.workspaceId !== scope.workspaceId ||
      receipt.sourceId !== scope.sourceId ||
      receipt.sourceVersionId !== scope.sourceVersionId
    ) {
      throw new Error("Source lifecycle event ID scope mismatch");
    }
  }

  private assertUuid(value: string, field: string): void {
    if (!validateUuid(value))
      throw new Error(`Source lifecycle ${field} must be a UUID`);
  }

  private assertPayload(payload: SourceLifecyclePayload): void {
    const allowedFields = new Set([
      "sourceId",
      "sourceVersionId",
      "internalToken",
      "projectId",
      "actor",
      "chunkCount",
      "indexedCount",
      "deliveryCount",
      "errorCode",
      "errorMessage",
    ]);
    if (Object.keys(payload).some((field) => !allowedFields.has(field))) {
      throw new Error("Source lifecycle payload contains an unknown field");
    }
    if (typeof payload.internalToken !== "string" || !payload.internalToken) {
      throw new Error("Source lifecycle event requires internalToken");
    }
    if (payload.projectId !== undefined && payload.projectId !== null) {
      this.assertUuid(payload.projectId, "projectId");
    }
    if (payload.actor !== undefined) {
      if (
        !payload.actor ||
        typeof payload.actor !== "object" ||
        (payload.actor.type !== "user" && payload.actor.type !== "service") ||
        typeof payload.actor.id !== "string" ||
        !payload.actor.id ||
        Object.keys(payload.actor).some(
          (field) => field !== "type" && field !== "id",
        )
      ) {
        throw new Error("Source lifecycle actor is invalid");
      }
    }
    for (const field of [
      "chunkCount",
      "indexedCount",
      "deliveryCount",
    ] as const) {
      const value = payload[field];
      if (
        value !== undefined &&
        (!Number.isSafeInteger(value) || (value as number) < 0)
      ) {
        throw new Error(
          `Source lifecycle ${field} must be a non-negative integer`,
        );
      }
    }
    for (const field of ["errorCode", "errorMessage"] as const) {
      const value = payload[field];
      if (value !== undefined && typeof value !== "string") {
        throw new Error(`Source lifecycle ${field} must be a string`);
      }
    }
  }
}
