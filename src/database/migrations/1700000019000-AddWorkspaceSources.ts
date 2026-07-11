import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceSources1700000019000 implements MigrationInterface {
  name = "AddWorkspaceSources1700000019000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE source_kind_enum AS ENUM ('document')`,
    );
    await queryRunner.query(
      `CREATE TYPE source_status_enum AS ENUM ('pending','processing','extracted','indexed','failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE source_processing_status_enum AS ENUM ('pending','processing','extracted','indexed','failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE workspace ADD CONSTRAINT uq_workspace_id_organization_source_scope UNIQUE(id, organization_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE project ADD CONSTRAINT uq_project_id_organization_source_scope UNIQUE(id, org_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE source (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL,
        project_id uuid,
        name varchar(255) NOT NULL,
        kind source_kind_enum NOT NULL,
        status source_status_enum NOT NULL DEFAULT 'pending',
        current_version_id uuid,
        created_by uuid NOT NULL REFERENCES "user"(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT fk_source_tenant_workspace
          FOREIGN KEY(workspace_id, organization_id)
          REFERENCES workspace(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_source_tenant_project
          FOREIGN KEY(project_id, organization_id)
          REFERENCES project(id, org_id) ON DELETE SET NULL (project_id),
        CONSTRAINT uq_source_tenant_identity UNIQUE(id, organization_id, workspace_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_source_org_workspace ON source(organization_id, workspace_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_source_tenant_status ON source(organization_id, workspace_id, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE source_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id uuid NOT NULL,
        organization_id uuid NOT NULL,
        workspace_id uuid NOT NULL,
        version_number integer NOT NULL,
        storage_bucket varchar(63) NOT NULL,
        storage_key text NOT NULL,
        filename varchar(255) NOT NULL,
        mime_type varchar(127) NOT NULL,
        size_bytes integer NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        processing_status source_processing_status_enum NOT NULL DEFAULT 'pending',
        extracted_at timestamptz,
        indexed_at timestamptz,
        failure_code varchar(100),
        failure_message text,
        created_by uuid NOT NULL REFERENCES "user"(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_source_version_tenant_source
          FOREIGN KEY(source_id, organization_id, workspace_id)
          REFERENCES source(id, organization_id, workspace_id) ON DELETE CASCADE,
        CONSTRAINT uq_source_version_tenant_identity
          UNIQUE(id, source_id, organization_id, workspace_id),
        CONSTRAINT uq_source_version_number UNIQUE(source_id, version_number),
        CONSTRAINT uq_source_version_storage UNIQUE(storage_bucket, storage_key),
        CONSTRAINT ck_source_version_number_positive CHECK(version_number > 0),
        CONSTRAINT ck_source_version_size_nonnegative CHECK(size_bytes >= 0),
        CONSTRAINT ck_source_version_checksum_sha256 CHECK(checksum_sha256 ~ '^[0-9a-f]{64}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_source_version_source_created ON source_version(source_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_source_version_tenant_status ON source_version(organization_id, workspace_id, processing_status)`,
    );
    await queryRunner.query(
      `ALTER TABLE source ADD CONSTRAINT fk_source_current_version_tenant
       FOREIGN KEY(current_version_id, id, organization_id, workspace_id)
       REFERENCES source_version(id, source_id, organization_id, workspace_id)
       ON DELETE SET NULL (current_version_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE source_lifecycle_event (
        event_id uuid PRIMARY KEY,
        event_type varchar(100) NOT NULL,
        organization_id uuid NOT NULL,
        workspace_id uuid NOT NULL,
        source_id uuid NOT NULL,
        source_version_id uuid NOT NULL,
        token_jti varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_source_lifecycle_event_type CHECK(event_type IN (
          'workspace.source.processing',
          'workspace.source.extracted',
          'workspace.source.indexed',
          'workspace.source.failed'
        )),
        CONSTRAINT fk_source_lifecycle_tenant_source
          FOREIGN KEY(source_id, organization_id, workspace_id)
          REFERENCES source(id, organization_id, workspace_id) ON DELETE CASCADE,
        CONSTRAINT fk_source_lifecycle_tenant_version
          FOREIGN KEY(source_version_id, source_id, organization_id, workspace_id)
          REFERENCES source_version(id, source_id, organization_id, workspace_id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_source_lifecycle_tenant_source ON source_lifecycle_event(organization_id, workspace_id, source_id, source_version_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_source_lifecycle_token_jti ON source_lifecycle_event(token_jti)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE source_lifecycle_event`);
    await queryRunner.query(
      `ALTER TABLE source DROP CONSTRAINT fk_source_current_version_tenant`,
    );
    await queryRunner.query(`DROP TABLE source_version`);
    await queryRunner.query(`DROP TABLE source`);
    await queryRunner.query(
      `ALTER TABLE project DROP CONSTRAINT uq_project_id_organization_source_scope`,
    );
    await queryRunner.query(
      `ALTER TABLE workspace DROP CONSTRAINT uq_workspace_id_organization_source_scope`,
    );
    await queryRunner.query(`DROP TYPE source_processing_status_enum`);
    await queryRunner.query(`DROP TYPE source_status_enum`);
    await queryRunner.query(`DROP TYPE source_kind_enum`);
  }
}
