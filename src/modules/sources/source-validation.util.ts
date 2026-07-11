import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

import {
  SOURCE_PROCESS_MIME_TYPES,
  SourceProcessMimeType,
} from "../../core/messaging/events/source-process-requested.event";
import { validateDocumentMimeType } from "../documents/utils/document-validation.util";

export const MAX_SOURCE_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function validateSourceMimeType(
  filename: string,
  buffer: Buffer,
  detectFileType?: (buffer: Buffer) => Promise<{ mime: string } | undefined>,
): Promise<SourceProcessMimeType> {
  const mimeType = await validateDocumentMimeType(
    filename,
    buffer,
    detectFileType,
  );
  if (!SOURCE_PROCESS_MIME_TYPES.includes(mimeType as SourceProcessMimeType)) {
    throw new UnsupportedMediaTypeException(
      "File type is not supported for source processing.",
    );
  }
  return mimeType as SourceProcessMimeType;
}

export function assertSourceFileSize(size: number): void {
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_SOURCE_FILE_SIZE_BYTES
  ) {
    throw new BadRequestException(
      `Source file size must be between 1 and ${MAX_SOURCE_FILE_SIZE_BYTES} bytes.`,
    );
  }
}

export function sanitizeSourceFilename(filename: string): string {
  const normalized = filename.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    hasControlCharacter(normalized)
  ) {
    throw new BadRequestException("Source filename is invalid.");
  }

  const sanitized = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const bounded = Array.from(sanitized).slice(-255).join("");
  if (!bounded || bounded === "." || bounded === "..") {
    throw new BadRequestException("Source filename is invalid.");
  }
  return bounded;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
