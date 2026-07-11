import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { validate as validateUuid } from "uuid";
import { EntityManager, Repository } from "typeorm";

import { JsonValue } from "../../../database/types/json-value.type";
import { CanvasObject } from "../entities/canvas-object.entity";
import { Canvas } from "../entities/canvas.entity";

export const MAX_ELEMENT_COUNT = 1000;
export const MAX_DIMENSION = 65536;
export const MAX_COORDINATE_MAGNITUDE = 1_000_000;
export const MAX_VISIBLE_TEXT_CHARACTERS = 10_000;

export const CANVAS_SNAPSHOT_ELEMENT_TYPES = [
  "text",
  "rectangle",
  "ellipse",
  "image",
  "line",
  "frame",
  "group",
  "activity",
  "gateway",
  "event",
  "connector",
  "annotation",
] as const;

export type CanvasSnapshotElementType =
  (typeof CANVAS_SNAPSHOT_ELEMENT_TYPES)[number];

export interface CanvasSnapshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasSnapshotElement {
  id: string;
  type: CanvasSnapshotElementType;
  bounds: CanvasSnapshotBounds;
  rotation: number;
  z_index: number;
  visible: boolean;
  locked: boolean;
  text: string | null;
  fill: string | null;
  stroke: string | null;
  asset_ref: string | null;
}

export interface CanvasSnapshotDocument {
  schema_version: "1";
  canvas: {
    id: string;
    revision: number;
    width: number;
    height: number;
    background: string;
  };
  elements: CanvasSnapshotElement[];
  relationships: Array<Record<string, unknown>>;
  groups: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

export interface SerializationResult {
  document: CanvasSnapshotDocument;
  /** The exact UTF-8 bytes written to MinIO. */
  jsonBytes: Buffer;
  checksumSha256: string;
  sizeBytes: number;
}

@Injectable()
export class CanvasSnapshotSerializer {
  constructor(
    @InjectRepository(CanvasObject)
    private readonly canvasObjectRepository: Repository<CanvasObject>,
    @InjectRepository(Canvas)
    private readonly canvasRepository: Repository<Canvas>,
  ) {}

  async serialize(
    canvasId: string,
    expectedRevision?: number,
    manager?: EntityManager,
  ): Promise<SerializationResult> {
    const canvasRepository = manager
      ? manager.getRepository(Canvas)
      : this.canvasRepository;
    const canvasObjectRepository = manager
      ? manager.getRepository(CanvasObject)
      : this.canvasObjectRepository;
    const canvas = await canvasRepository.findOne({
      where: { id: canvasId },
    });
    if (!canvas) {
      throw new BadRequestException("Canvas not found");
    }

    const objects = await canvasObjectRepository.find({
      where: { canvasId },
      order: { id: "ASC" },
    });
    if (objects.length > MAX_ELEMENT_COUNT) {
      throw new BadRequestException(
        `Canvas exceeds maximum element count of ${MAX_ELEMENT_COUNT}`,
      );
    }

    const revision = this.toSafeInteger(canvas.revision, "canvas.revision");
    this.validateNonnegative(revision, "canvas.revision");
    if (expectedRevision !== undefined && revision !== expectedRevision) {
      throw new BadRequestException(
        `Canvas revision changed: expected ${expectedRevision}, received ${revision}`,
      );
    }
    const canvasWidth = this.toSafeInteger(canvas.width, "canvas.width");
    const canvasHeight = this.toSafeInteger(canvas.height, "canvas.height");
    this.validateDimension(canvasWidth, "canvas.width");
    this.validateDimension(canvasHeight, "canvas.height");
    const background = this.readColor(canvas.background, "canvas.background");
    if (background === null) {
      throw new BadRequestException("canvas.background must be a color");
    }

    const elements = objects
      .map((object) => this.serializeElement(object))
      .sort((left, right) => left.id.localeCompare(right.id));

    const document: CanvasSnapshotDocument = {
      schema_version: "1",
      canvas: {
        id: canvas.id,
        revision,
        width: canvasWidth,
        height: canvasHeight,
        background,
      },
      elements,
      relationships: [],
      groups: [],
      metadata: {},
    };

    const jsonBytes = Buffer.from(
      JSON.stringify(this.canonicalize(document)),
      "utf8",
    );
    const checksumSha256 = createHash("sha256").update(jsonBytes).digest("hex");

    return {
      document,
      jsonBytes,
      checksumSha256,
      sizeBytes: jsonBytes.length,
    };
  }

  private serializeElement(object: CanvasObject): CanvasSnapshotElement {
    if (
      !CANVAS_SNAPSHOT_ELEMENT_TYPES.includes(
        object.type as CanvasSnapshotElementType,
      )
    ) {
      throw new BadRequestException(
        `Unknown canvas element type: ${object.type}`,
      );
    }

    this.assertNoExecutableOrSecret(object.properties, "properties");
    this.assertNoExecutableOrSecret(object.style, "style");
    this.assertNoExecutableOrSecret(object.label, "label");

    const properties = this.asRecord(object.properties);
    const style = this.asRecord(object.style);
    const x = this.readFiniteNumber(object.positionX, "position_x");
    const y = this.readFiniteNumber(object.positionY, "position_y");
    this.validateCoordinate(x, "position_x");
    this.validateCoordinate(y, "position_y");
    const width = this.readFiniteNumber(object.width ?? 0, "width");
    const height = this.readFiniteNumber(object.height ?? 0, "height");
    this.validateDimension(width, "width", true);
    this.validateDimension(height, "height", true);

    const rotation = this.readOptionalNumber(
      style.rotation ?? properties.rotation,
      0,
      "rotation",
    );
    if (Math.abs(rotation) > 360_000) {
      throw new BadRequestException("rotation is outside the supported range");
    }
    const zIndex = this.toSafeInteger(
      style.z_index ?? style.zIndex ?? properties.z_index ?? 0,
      "z_index",
    );
    if (Math.abs(zIndex) > 1_000_000) {
      throw new BadRequestException("z_index is outside the supported range");
    }

    const text = this.readVisibleText(object.label, properties.text);
    const fill = this.readColor(style.fill ?? properties.fill, "fill", true);
    const stroke = this.readColor(
      style.stroke ?? properties.stroke,
      "stroke",
      true,
    );
    const assetRef = this.readAssetReference(
      properties.asset_ref ?? properties.assetRef,
    );
    const visible = this.readBoolean(
      properties.visible ?? style.visible,
      true,
      "visible",
    );

    return {
      id: object.id,
      type: object.type as CanvasSnapshotElementType,
      bounds: { x, y, width, height },
      rotation,
      z_index: zIndex,
      visible,
      locked: object.isLocked,
      text,
      fill,
      stroke,
      asset_ref: assetRef,
    };
  }

  private readVisibleText(
    label: string | null,
    propertyText: unknown,
  ): string | null {
    const value = label ?? propertyText ?? null;
    if (value === null) return null;
    if (typeof value !== "string") {
      throw new BadRequestException("Visible text must be a string");
    }
    if (Array.from(value).length > MAX_VISIBLE_TEXT_CHARACTERS) {
      throw new BadRequestException("Visible text exceeds the snapshot limit");
    }
    return value;
  }

  private readAssetReference(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || !value.startsWith("asset://")) {
      throw new BadRequestException(
        "asset_ref must be null or an asset:// UUID reference",
      );
    }
    const assetId = value.slice("asset://".length);
    if (!validateUuid(assetId) || value !== `asset://${assetId}`) {
      throw new BadRequestException(
        "asset_ref must be null or an asset:// UUID reference",
      );
    }
    return value;
  }

  private readColor(
    value: unknown,
    field: string,
    nullable = false,
  ): string | null {
    if (value === undefined || value === null) {
      if (nullable) return null;
      throw new BadRequestException(`${field} must be a color`);
    }
    if (
      typeof value !== "string" ||
      !/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(value)
    ) {
      throw new BadRequestException(`${field} must be a hexadecimal color`);
    }
    return value;
  }

  private readBoolean(
    value: unknown,
    fallback: boolean,
    field: string,
  ): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }
    return value;
  }

  private readOptionalNumber(
    value: unknown,
    fallback: number,
    field: string,
  ): number {
    if (value === undefined || value === null) return fallback;
    return this.readFiniteNumber(value, field);
  }

  private readFiniteNumber(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a finite number`);
    }
    return value;
  }

  private toSafeInteger(value: unknown, field: string): number {
    const normalized =
      typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    if (typeof normalized !== "number" || !Number.isSafeInteger(normalized)) {
      throw new BadRequestException(`${field} must be a safe integer`);
    }
    return normalized;
  }

  private validateCoordinate(value: number, field: string): void {
    if (Math.abs(value) > MAX_COORDINATE_MAGNITUDE) {
      throw new BadRequestException(`${field} is outside the supported range`);
    }
  }

  private validateDimension(
    value: number,
    field: string,
    allowZero = false,
  ): void {
    const minimum = allowZero ? 0 : 1;
    if (value < minimum || value > MAX_DIMENSION) {
      throw new BadRequestException(
        `${field} must be between ${minimum} and ${MAX_DIMENSION}`,
      );
    }
  }

  private validateNonnegative(value: number, field: string): void {
    if (value < 0) {
      throw new BadRequestException(`${field} must not be negative`);
    }
  }

  private asRecord(value: JsonValue | null): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }
    if (value !== null && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.canonicalize(
            (value as Record<string, unknown>)[key],
          );
          return result;
        }, {});
    }
    return value;
  }

  private assertNoExecutableOrSecret(value: unknown, path: string): void {
    if (typeof value === "string") {
      if (
        /<script\b|javascript\s*:|data\s*:\s*text\/html/i.test(value) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value) ||
        /\b(?:sk|pk)_[A-Za-z0-9_-]{20,}\b/.test(value) ||
        /\bAKIA[0-9A-Z]{16}\b/.test(value)
      ) {
        throw new BadRequestException(
          `${path} contains executable content or a credential`,
        );
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.assertNoExecutableOrSecret(item, `${path}[${index}]`),
      );
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (
          /^(?:password|passwd|secret|token|api[_-]?key|private[_-]?key)$/i.test(
            key,
          )
        ) {
          throw new BadRequestException(
            `${path}.${key} is not allowed in a snapshot`,
          );
        }
        this.assertNoExecutableOrSecret(child, `${path}.${key}`);
      }
    }
  }
}
