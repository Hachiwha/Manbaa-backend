import { getMetadataArgsStorage } from "typeorm";

import {
  Source,
  SourceKind,
  SourceProcessingStatus,
  SourceStatus,
  SourceVersion,
} from ".";

describe("source entity metadata", () => {
  it("declares every canonical source field and lifecycle enum value", () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === Source)
      .map((column) => column.propertyName);

    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "organizationId",
        "workspaceId",
        "projectId",
        "name",
        "kind",
        "status",
        "currentVersionId",
        "createdBy",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    );
    expect(Object.values(SourceKind)).toEqual(["document"]);
    expect(Object.values(SourceStatus)).toEqual([
      "pending",
      "processing",
      "extracted",
      "indexed",
      "failed",
    ]);
  });

  it("declares version uniqueness, checks, and processing state metadata", () => {
    const metadata = getMetadataArgsStorage();
    const columns = metadata.columns
      .filter((column) => column.target === SourceVersion)
      .map((column) => column.propertyName);
    const uniqueNames = metadata.uniques
      .filter((unique) => unique.target === SourceVersion)
      .map((unique) => unique.name);
    const checkNames = metadata.checks
      .filter((check) => check.target === SourceVersion)
      .map((check) => check.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "sourceId",
        "organizationId",
        "workspaceId",
        "versionNumber",
        "storageBucket",
        "storageKey",
        "filename",
        "mimeType",
        "sizeBytes",
        "checksumSha256",
        "processingStatus",
        "extractedAt",
        "indexedAt",
        "failureCode",
        "failureMessage",
        "createdBy",
        "createdAt",
      ]),
    );
    expect(uniqueNames).toEqual(
      expect.arrayContaining([
        "uq_source_version_number",
        "uq_source_version_storage",
        "uq_source_version_tenant_identity",
      ]),
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "ck_source_version_number_positive",
        "ck_source_version_size_nonnegative",
        "ck_source_version_checksum_sha256",
      ]),
    );
    expect(Object.values(SourceProcessingStatus)).toEqual(
      Object.values(SourceStatus),
    );
  });
});
