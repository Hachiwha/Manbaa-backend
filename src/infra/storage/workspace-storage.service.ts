import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { Client, CopyConditions } from "minio";

export const WORKSPACE_BUCKETS = [
  "workspace-sources",
  "workspace-previews",
  "workspace-assets",
  "workspace-exports",
  "workspace-snapshots",
  "workspace-temp",
] as const;

export type WorkspaceBucket = string;

export interface WorkspaceObjectContext {
  organizationId: string;
  workspaceId: string;
}

export interface StoredWorkspaceSnapshot {
  bucket: string;
  key: string;
  checksumSha256: string;
  contentType: "application/json";
  sizeBytes: number;
}

@Injectable()
export class WorkspaceStorageService implements OnModuleInit {
  private readonly client: Client;
  private readonly buckets: Record<
    "sources" | "previews" | "assets" | "exports" | "snapshots" | "temp",
    string
  >;

  constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.getOrThrow<string>("minio.endpoint"),
      port: config.getOrThrow<number>("minio.port"),
      useSSL: config.getOrThrow<boolean>("minio.useSsl"),
      accessKey: config.getOrThrow<string>("minio.accessKey"),
      secretKey: config.getOrThrow<string>("minio.secretKey"),
      region: "us-east-1",
    });
    this.buckets = {
      sources: config.get<string>("minio.bucketSources", WORKSPACE_BUCKETS[0]),
      previews: config.get<string>(
        "minio.bucketPreviews",
        WORKSPACE_BUCKETS[1],
      ),
      assets: config.get<string>("minio.bucketAssets", WORKSPACE_BUCKETS[2]),
      exports: config.get<string>(
        "minio.bucketWorkspaceExports",
        WORKSPACE_BUCKETS[3],
      ),
      snapshots: config.get<string>(
        "minio.bucketSnapshots",
        WORKSPACE_BUCKETS[4],
      ),
      temp: config.get<string>("minio.bucketTemp", WORKSPACE_BUCKETS[5]),
    };
  }

  async onModuleInit() {
    for (const bucket of this.allowedBuckets()) {
      if (!(await this.client.bucketExists(bucket))) {
        await this.client.makeBucket(bucket);
      }
    }
  }

  getAssetBucket(): WorkspaceBucket {
    return this.buckets.assets;
  }

  getSourceBucket(): WorkspaceBucket {
    return this.buckets.sources;
  }

  getSnapshotBucket(): WorkspaceBucket {
    return this.buckets.snapshots;
  }

  getPreviewBucket(): WorkspaceBucket {
    return this.buckets.previews;
  }

  buildWorkspaceObjectPath(
    ctx: WorkspaceObjectContext,
    entityType: string,
    entityId: string,
    version: number,
    filename: string,
  ) {
    for (const part of [
      ctx.organizationId,
      ctx.workspaceId,
      entityType,
      entityId,
      String(version),
      filename,
    ]) {
      this.validateSegment(part);
    }
    return `${ctx.organizationId}/${ctx.workspaceId}/${entityType}/${entityId}/${version}/${filename}`;
  }

  buildSourceObjectPath(
    ctx: WorkspaceObjectContext,
    sourceId: string,
    sourceVersionId: string,
    filename: string,
  ): string {
    for (const part of [
      "organizations",
      ctx.organizationId,
      "workspaces",
      ctx.workspaceId,
      "sources",
      sourceId,
      "versions",
      sourceVersionId,
      filename,
    ]) {
      this.validateSegment(part);
    }
    return `organizations/${ctx.organizationId}/workspaces/${ctx.workspaceId}/sources/${sourceId}/versions/${sourceVersionId}/${filename}`;
  }

  buildSnapshotObjectPath(
    ctx: WorkspaceObjectContext,
    canvasId: string,
    snapshotId: string,
    snapshotVersion: number,
  ): string {
    this.validatePositiveVersion(snapshotVersion);
    for (const part of [
      "organizations",
      ctx.organizationId,
      "workspaces",
      ctx.workspaceId,
      "canvases",
      canvasId,
      "snapshots",
      snapshotId,
      `snapshot-v${snapshotVersion}.json`,
    ]) {
      this.validateSegment(part);
    }
    return `organizations/${ctx.organizationId}/workspaces/${ctx.workspaceId}/canvases/${canvasId}/snapshots/${snapshotId}/snapshot-v${snapshotVersion}.json`;
  }

  buildPreviewObjectPath(
    ctx: WorkspaceObjectContext,
    canvasId: string,
    snapshotId: string,
    snapshotVersion: number,
  ): string {
    this.validatePositiveVersion(snapshotVersion);
    for (const part of [
      "organizations",
      ctx.organizationId,
      "workspaces",
      ctx.workspaceId,
      "canvases",
      canvasId,
      "snapshots",
      snapshotId,
      `preview-v${snapshotVersion}.png`,
    ]) {
      this.validateSegment(part);
    }
    return `organizations/${ctx.organizationId}/workspaces/${ctx.workspaceId}/canvases/${canvasId}/snapshots/${snapshotId}/preview-v${snapshotVersion}.png`;
  }

  validateWorkspaceObjectPath(
    ctx: WorkspaceObjectContext,
    bucket: string,
    key: string,
  ) {
    if (!this.allowedBuckets().includes(bucket))
      throw new BadRequestException("Unsupported storage bucket");
    if (Buffer.byteLength(key, "utf8") > 1024) {
      throw new BadRequestException("Invalid object path");
    }
    const decoded = this.decodePathComponent(key);
    if (
      Buffer.byteLength(decoded, "utf8") > 1024 ||
      decoded.startsWith("/") ||
      decoded.includes("\\") ||
      this.hasControlCharacter(decoded) ||
      decoded.split("/").some((p) => !p || p === "." || p === "..")
    ) {
      throw new BadRequestException("Invalid object path");
    }
    const tenantPrefixes = [
      `${ctx.organizationId}/${ctx.workspaceId}/`,
      `organizations/${ctx.organizationId}/workspaces/${ctx.workspaceId}/`,
    ];
    if (!tenantPrefixes.some((prefix) => decoded.startsWith(prefix))) {
      throw new ForbiddenException("Object is outside workspace scope");
    }
    return decoded;
  }

  async createSignedUploadUrl(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
    ttl = 900,
  ) {
    return this.client.presignedPutObject(
      bucket,
      this.validateWorkspaceObjectPath(ctx, bucket, key),
      ttl,
    );
  }

  async createSignedDownloadUrl(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
    ttl = 900,
  ) {
    return this.client.presignedGetObject(
      bucket,
      this.validateWorkspaceObjectPath(ctx, bucket, key),
      ttl,
    );
  }

  async objectExists(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
  ) {
    try {
      await this.getObjectMetadata(ctx, bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
  ) {
    return this.client.statObject(
      bucket,
      this.validateWorkspaceObjectPath(ctx, bucket, key),
    );
  }

  async deleteObject(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
  ) {
    await this.client.removeObject(
      bucket,
      this.validateWorkspaceObjectPath(ctx, bucket, key),
    );
  }

  async copyObject(
    ctx: WorkspaceObjectContext,
    sourceBucket: WorkspaceBucket,
    sourceKey: string,
    targetBucket: WorkspaceBucket,
    targetKey: string,
  ) {
    const source = this.validateWorkspaceObjectPath(
      ctx,
      sourceBucket,
      sourceKey,
    );
    const target = this.validateWorkspaceObjectPath(
      ctx,
      targetBucket,
      targetKey,
    );
    return this.client.copyObject(
      targetBucket,
      target,
      `/${sourceBucket}/${source}`,
      new CopyConditions(),
    );
  }

  async storeChecksum(
    ctx: WorkspaceObjectContext,
    bucket: WorkspaceBucket,
    key: string,
    content: Buffer,
  ) {
    const checksum = createHash("sha256").update(content).digest("hex");
    await this.client.putObject(
      bucket,
      this.validateWorkspaceObjectPath(ctx, bucket, key),
      content,
      content.length,
      {
        "x-amz-meta-checksum-sha256": checksum,
      },
    );
    return checksum;
  }

  async storeSource(
    ctx: WorkspaceObjectContext,
    key: string,
    content: Buffer,
    mimeType: string,
  ): Promise<{ bucket: string; key: string; checksumSha256: string }> {
    const bucket = this.getSourceBucket();
    const validatedKey = this.validateWorkspaceObjectPath(ctx, bucket, key);
    const checksumSha256 = createHash("sha256").update(content).digest("hex");

    await this.client.putObject(bucket, validatedKey, content, content.length, {
      "Content-Type": mimeType,
      "x-amz-meta-checksum-sha256": checksumSha256,
    });

    return { bucket, key: validatedKey, checksumSha256 };
  }

  async storeSnapshot(
    ctx: WorkspaceObjectContext,
    canvasId: string,
    snapshotId: string,
    snapshotVersion: number,
    content: Buffer,
  ): Promise<StoredWorkspaceSnapshot> {
    const bucket = this.getSnapshotBucket();
    const key = this.buildSnapshotObjectPath(
      ctx,
      canvasId,
      snapshotId,
      snapshotVersion,
    );
    const validatedKey = this.validateWorkspaceObjectPath(ctx, bucket, key);
    const checksumSha256 = createHash("sha256").update(content).digest("hex");

    await this.client.putObject(bucket, validatedKey, content, content.length, {
      "Content-Type": "application/json",
      "x-amz-meta-checksum-sha256": checksumSha256,
    });

    return {
      bucket,
      key: validatedKey,
      checksumSha256,
      contentType: "application/json",
      sizeBytes: content.length,
    };
  }

  private allowedBuckets() {
    return Object.values(this.buckets);
  }

  private validateSegment(value: string) {
    const decoded = this.decodePathComponent(value);
    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      this.hasControlCharacter(decoded)
    ) {
      throw new BadRequestException("Invalid path segment");
    }
  }

  private validatePositiveVersion(version: number): void {
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new BadRequestException(
        "Snapshot version must be a positive integer",
      );
    }
  }

  private decodePathComponent(value: string): string {
    let decoded = value;
    for (let depth = 0; depth < 5; depth += 1) {
      let next: string;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        throw new BadRequestException("Invalid object path encoding");
      }
      if (next === decoded) return decoded;
      decoded = next;
    }
    throw new BadRequestException("Object path is encoded too deeply");
  }

  private hasControlCharacter(value: string): boolean {
    return Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
  }
}
