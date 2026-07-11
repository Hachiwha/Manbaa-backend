import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

import {
  assertSourceFileSize,
  MAX_SOURCE_FILE_SIZE_BYTES,
  sanitizeSourceFilename,
  validateSourceMimeType,
} from "./source-validation.util";

describe("source upload validation", () => {
  it("accepts canonical UTF-8 text and normalizes a safe filename", async () => {
    await expect(
      validateSourceMimeType(
        "brief.txt",
        Buffer.from("hello world\n"),
        async () => undefined,
      ),
    ).resolves.toBe("text/plain");
    expect(sanitizeSourceFilename(" Brand brief 2026.txt ")).toBe(
      "Brand-brief-2026.txt",
    );
  });

  it("rejects a MIME type unsupported by the document worker", async () => {
    const png = Buffer.from("89504E470D0A1A0A0000000D49484452", "hex");
    await expect(
      validateSourceMimeType("image.png", png, async () => ({
        mime: "image/png",
      })),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it("enforces the source upload size limit", () => {
    expect(() => assertSourceFileSize(0)).toThrow(BadRequestException);
    expect(() => assertSourceFileSize(MAX_SOURCE_FILE_SIZE_BYTES + 1)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    "../brief.txt",
    "..\\brief.txt",
    "/tmp/brief.txt",
    "bad\u0000.txt",
    "\n",
  ])("rejects unsafe filename %p", (filename) => {
    expect(() => sanitizeSourceFilename(filename)).toThrow(BadRequestException);
  });

  it("rejects a file whose signature does not match its extension", async () => {
    await expect(
      validateSourceMimeType(
        "brief.pdf",
        Buffer.from("not a pdf"),
        async () => ({
          mime: "image/png",
        }),
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });
});
