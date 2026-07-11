import { BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";

import { CanvasObject } from "../entities/canvas-object.entity";
import { Canvas } from "../entities/canvas.entity";
import { CanvasSnapshotSerializer } from "./canvas-snapshot-serializer.service";

describe("CanvasSnapshotSerializer", () => {
  const canvasId = "10000000-0000-4000-8000-000000000009";
  const canonicalBytes = Buffer.from(
    '{"canvas":{"background":"#FFFFFF","height":1024,"id":"10000000-0000-4000-8000-000000000009","revision":148,"width":1440},"elements":[{"asset_ref":null,"bounds":{"height":90,"width":380,"x":120,"y":80},"fill":"#071A2B","id":"hero-title","locked":false,"rotation":0,"stroke":null,"text":"Hisn","type":"text","visible":true,"z_index":10},{"asset_ref":"asset://10000000-0000-4000-8000-000000000012","bounds":{"height":48,"width":48,"x":40,"y":40},"fill":null,"id":"logo-mark","locked":true,"rotation":0,"stroke":null,"text":null,"type":"image","visible":true,"z_index":20}],"groups":[],"metadata":{},"relationships":[],"schema_version":"1"}',
    "utf8",
  );

  const canvas = Object.assign(new Canvas(), {
    id: canvasId,
    workflowId: "20000000-0000-4000-8000-000000000001",
    workspaceId: "10000000-0000-4000-8000-000000000003",
    revision: 148,
    width: 1440,
    height: 1024,
    background: "#FFFFFF",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const hero = Object.assign(new CanvasObject(), {
    id: "hero-title",
    canvasId,
    type: "text",
    elsaType: null,
    label: "Hisn",
    properties: {},
    positionX: 120,
    positionY: 80,
    width: 380,
    height: 90,
    style: { fill: "#071A2B", z_index: 10 },
    isLocked: false,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const logo = Object.assign(new CanvasObject(), {
    id: "logo-mark",
    canvasId,
    type: "image",
    elsaType: null,
    label: null,
    properties: {
      asset_ref: "asset://10000000-0000-4000-8000-000000000012",
    },
    positionX: 40,
    positionY: 40,
    width: 48,
    height: 48,
    style: { z_index: 20 },
    isLocked: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  function setup(objects = [logo, hero]) {
    const canvasRepository = {
      findOne: jest.fn().mockResolvedValue(canvas),
    };
    const objectRepository = { find: jest.fn().mockResolvedValue(objects) };
    return {
      canvasRepository,
      objectRepository,
      serializer: new CanvasSnapshotSerializer(
        objectRepository as never,
        canvasRepository as never,
      ),
    };
  }

  it("produces the locked canonical bytes, checksum, and stable ID ordering", async () => {
    const { serializer } = setup();

    const result = await serializer.serialize(canvasId, 148);

    expect(result.jsonBytes).toEqual(canonicalBytes);
    expect(result.sizeBytes).toBe(636);
    expect(result.checksumSha256).toBe(
      "63bc82fd261288f1b65492d393d90e56227b65b95d57bf0b89f9b91e76906544",
    );
    expect(createHash("sha256").update(result.jsonBytes).digest("hex")).toBe(
      result.checksumSha256,
    );
    expect(result.document.elements.map(({ id }) => id)).toEqual([
      "hero-title",
      "logo-mark",
    ]);
    expect(result.document.elements[0].text).toBe("Hisn");
    expect(result.document.elements[0].bounds).toEqual({
      x: 120,
      y: 80,
      width: 380,
      height: 90,
    });
    expect(result.document.elements[0].z_index).toBe(10);
  });

  it("reads from the supplied transaction manager and rejects revision drift", async () => {
    const dependencies = setup();
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Canvas
          ? dependencies.canvasRepository
          : dependencies.objectRepository,
      ),
    };

    await expect(
      dependencies.serializer.serialize(canvasId, 147, manager as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.getRepository).toHaveBeenCalledWith(Canvas);
    expect(manager.getRepository).toHaveBeenCalledWith(CanvasObject);
  });

  it.each([
    ["unknown element", { type: "script" }],
    ["unsafe asset", { properties: { asset_ref: "https://evil.test/x" } }],
    ["non-finite geometry", { positionX: Number.POSITIVE_INFINITY }],
    ["executable text", { label: "<script>alert(1)</script>" }],
    ["secret property", { properties: { api_key: "not-for-snapshots" } }],
  ])("rejects %s", async (_label, changes) => {
    const unsafe = Object.assign(new CanvasObject(), hero, changes);
    const { serializer } = setup([unsafe]);

    await expect(serializer.serialize(canvasId, 148)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
