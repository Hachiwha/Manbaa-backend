import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCanvasAiPreviewPersistence1700000021000 implements MigrationInterface {
  name = "AddCanvasAiPreviewPersistence1700000021000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'superseded'`,
    );
    await queryRunner.query(
      `ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'stale'`,
    );

    await queryRunner.query(`
      ALTER TABLE canvas
        ADD COLUMN workspace_id uuid,
        ADD COLUMN revision bigint NOT NULL DEFAULT 0,
        ADD COLUMN width integer NOT NULL DEFAULT 1440,
        ADD COLUMN height integer NOT NULL DEFAULT 1024,
        ADD COLUMN background varchar(9) NOT NULL DEFAULT '#FFFFFF',
        ADD CONSTRAINT fk_canvas_workspace
          FOREIGN KEY(workspace_id) REFERENCES workspace(id) ON DELETE RESTRICT,
        ADD CONSTRAINT uq_canvas_workspace_binding UNIQUE(id, workspace_id),
        ADD CONSTRAINT ck_canvas_revision_nonnegative CHECK(revision >= 0),
        ADD CONSTRAINT ck_canvas_width_bounded CHECK(width BETWEEN 1 AND 65536),
        ADD CONSTRAINT ck_canvas_height_bounded CHECK(height BETWEEN 1 AND 65536),
        ADD CONSTRAINT ck_canvas_background_color
          CHECK(background ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$')
    `);
    await queryRunner.query(
      `CREATE INDEX idx_canvas_workspace ON canvas(workspace_id) WHERE workspace_id IS NOT NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE canvas_operation
        ADD COLUMN organization_id uuid,
        ADD COLUMN workspace_id uuid,
        ADD COLUMN client_revision bigint,
        ADD CONSTRAINT fk_canvas_operation_tenant_workspace
          FOREIGN KEY(workspace_id, organization_id)
          REFERENCES workspace(id, organization_id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_canvas_operation_canvas_workspace
          FOREIGN KEY(canvas_id, workspace_id)
          REFERENCES canvas(id, workspace_id) ON DELETE CASCADE,
        ADD CONSTRAINT ck_canvas_operation_phase04_scope CHECK(
          (organization_id IS NULL AND workspace_id IS NULL AND client_revision IS NULL)
          OR
          (organization_id IS NOT NULL AND workspace_id IS NOT NULL AND client_revision IS NOT NULL)
        ),
        ADD CONSTRAINT ck_canvas_operation_client_revision
          CHECK(client_revision IS NULL OR client_revision >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_canvas_operation_tenant_revision
        ON canvas_operation(organization_id, workspace_id, canvas_id, sequence_number)
        WHERE organization_id IS NOT NULL AND workspace_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_canvas_operation_client_revision
        ON canvas_operation(canvas_id, client_revision)
        WHERE client_revision IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE ai_preview_snapshot (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL,
        project_id uuid,
        canvas_id uuid NOT NULL,
        snapshot_version integer NOT NULL,
        canvas_revision bigint NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'available',
        storage_bucket varchar(63) NOT NULL DEFAULT 'workspace-snapshots',
        storage_key varchar(1024) NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        content_type varchar(127) NOT NULL DEFAULT 'application/json',
        size_bytes integer NOT NULL,
        preview_status varchar(32) NOT NULL DEFAULT 'pending',
        preview_bucket varchar(63),
        preview_key varchar(1024),
        preview_checksum_sha256 char(64),
        created_by uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        superseded_by_snapshot_id uuid,
        CONSTRAINT fk_ai_preview_snapshot_tenant_workspace
          FOREIGN KEY(workspace_id, organization_id)
          REFERENCES workspace(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_ai_preview_snapshot_tenant_project
          FOREIGN KEY(project_id, organization_id)
          REFERENCES project(id, org_id) ON DELETE SET NULL (project_id),
        CONSTRAINT fk_ai_preview_snapshot_canvas_workspace
          FOREIGN KEY(canvas_id, workspace_id)
          REFERENCES canvas(id, workspace_id) ON DELETE CASCADE,
        CONSTRAINT uq_ai_preview_snapshot_canvas_version
          UNIQUE(canvas_id, snapshot_version),
        CONSTRAINT uq_ai_preview_snapshot_storage
          UNIQUE(storage_bucket, storage_key),
        CONSTRAINT uq_ai_preview_snapshot_identity
          UNIQUE(id, canvas_id, organization_id, workspace_id),
        CONSTRAINT uq_ai_preview_snapshot_lineage_identity
          UNIQUE(
            id,
            canvas_id,
            snapshot_version,
            canvas_revision,
            organization_id,
            workspace_id
          ),
        CONSTRAINT ck_ai_preview_snapshot_version_positive
          CHECK(snapshot_version > 0),
        CONSTRAINT ck_ai_preview_snapshot_revision_nonnegative
          CHECK(canvas_revision >= 0),
        CONSTRAINT ck_ai_preview_snapshot_status
          CHECK(status IN ('pending', 'available', 'superseded', 'failed')),
        CONSTRAINT ck_ai_preview_snapshot_storage_bucket
          CHECK(storage_bucket = 'workspace-snapshots'),
        CONSTRAINT ck_ai_preview_snapshot_storage_key CHECK(
          storage_key = format(
            'organizations/%s/workspaces/%s/canvases/%s/snapshots/%s/snapshot-v%s.json',
            organization_id,
            workspace_id,
            canvas_id,
            id,
            snapshot_version
          )
        ),
        CONSTRAINT ck_ai_preview_snapshot_checksum
          CHECK(checksum_sha256 ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_ai_preview_snapshot_content_type
          CHECK(content_type = 'application/json'),
        CONSTRAINT ck_ai_preview_snapshot_size_nonnegative
          CHECK(size_bytes >= 0),
        CONSTRAINT ck_ai_preview_snapshot_preview_status
          CHECK(preview_status IN ('pending', 'available')),
        CONSTRAINT ck_ai_preview_snapshot_preview_consistency CHECK(
          (
            preview_status = 'pending'
            AND preview_bucket IS NULL
            AND preview_key IS NULL
            AND preview_checksum_sha256 IS NULL
          )
          OR
          (
            preview_status = 'available'
            AND preview_bucket = 'workspace-previews'
            AND preview_key = format(
              'organizations/%s/workspaces/%s/canvases/%s/snapshots/%s/preview-v%s.png',
              organization_id,
              workspace_id,
              canvas_id,
              id,
              snapshot_version
            )
            AND preview_checksum_sha256 ~ '^[0-9a-f]{64}$'
          )
        ),
        CONSTRAINT ck_ai_preview_snapshot_not_self_superseded
          CHECK(superseded_by_snapshot_id IS NULL OR superseded_by_snapshot_id <> id)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE ai_preview_snapshot
        ADD CONSTRAINT fk_ai_preview_snapshot_superseded_by
          FOREIGN KEY(
            superseded_by_snapshot_id,
            canvas_id,
            organization_id,
            workspace_id
          )
          REFERENCES ai_preview_snapshot(id, canvas_id, organization_id, workspace_id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_preview_snapshot_tenant_created
        ON ai_preview_snapshot(organization_id, workspace_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_preview_snapshot_canvas_revision
        ON ai_preview_snapshot(canvas_id, canvas_revision DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_preview_snapshot_superseded_by
        ON ai_preview_snapshot(superseded_by_snapshot_id)
        WHERE superseded_by_snapshot_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE FUNCTION enforce_ai_preview_snapshot_immutable()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF ROW(
          NEW.id,
          NEW.organization_id,
          NEW.workspace_id,
          NEW.project_id,
          NEW.canvas_id,
          NEW.snapshot_version,
          NEW.canvas_revision,
          NEW.storage_bucket,
          NEW.storage_key,
          NEW.checksum_sha256,
          NEW.content_type,
          NEW.size_bytes,
          NEW.created_by,
          NEW.created_at
        ) IS DISTINCT FROM ROW(
          OLD.id,
          OLD.organization_id,
          OLD.workspace_id,
          OLD.project_id,
          OLD.canvas_id,
          OLD.snapshot_version,
          OLD.canvas_revision,
          OLD.storage_bucket,
          OLD.storage_key,
          OLD.checksum_sha256,
          OLD.content_type,
          OLD.size_bytes,
          OLD.created_by,
          OLD.created_at
        ) THEN
          RAISE EXCEPTION 'AI preview snapshot artifact metadata is immutable';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_ai_preview_snapshot_immutable
      BEFORE UPDATE ON ai_preview_snapshot
      FOR EACH ROW EXECUTE FUNCTION enforce_ai_preview_snapshot_immutable()
    `);

    await queryRunner.query(`
      ALTER TABLE ai_task
        ADD COLUMN canvas_id uuid,
        ADD COLUMN snapshot_id uuid,
        ADD COLUMN snapshot_version integer,
        ADD COLUMN canvas_revision bigint,
        ADD COLUMN superseded_by_task_id uuid,
        ADD CONSTRAINT uq_ai_task_tenant_identity
          UNIQUE(id, organization_id, workspace_id),
        ADD CONSTRAINT fk_ai_task_canvas_workspace
          FOREIGN KEY(canvas_id, workspace_id)
          REFERENCES canvas(id, workspace_id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_ai_task_snapshot_lineage
          FOREIGN KEY(
            snapshot_id,
            canvas_id,
            snapshot_version,
            canvas_revision,
            organization_id,
            workspace_id
          )
          REFERENCES ai_preview_snapshot(
            id,
            canvas_id,
            snapshot_version,
            canvas_revision,
            organization_id,
            workspace_id
          )
          ON DELETE RESTRICT,
        ADD CONSTRAINT fk_ai_task_superseded_by
          FOREIGN KEY(superseded_by_task_id, organization_id, workspace_id)
          REFERENCES ai_task(id, organization_id, workspace_id)
          ON DELETE RESTRICT,
        ADD CONSTRAINT ck_ai_task_snapshot_lineage_complete CHECK(
          (
            canvas_id IS NULL
            AND snapshot_id IS NULL
            AND snapshot_version IS NULL
            AND canvas_revision IS NULL
          )
          OR
          (
            canvas_id IS NOT NULL
            AND snapshot_id IS NOT NULL
            AND snapshot_version IS NOT NULL
            AND snapshot_version > 0
            AND canvas_revision IS NOT NULL
            AND canvas_revision >= 0
          )
        ),
        ADD CONSTRAINT ck_ai_task_not_self_superseded
          CHECK(superseded_by_task_id IS NULL OR superseded_by_task_id <> id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_task_canvas_preview_lineage
        ON ai_task(organization_id, workspace_id, canvas_id, canvas_revision DESC)
        WHERE canvas_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_task_superseded_by
        ON ai_task(superseded_by_task_id)
        WHERE superseded_by_task_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_task_superseded_by`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_ai_task_canvas_preview_lineage`,
    );
    await queryRunner.query(`
      ALTER TABLE ai_task
        DROP CONSTRAINT IF EXISTS ck_ai_task_not_self_superseded,
        DROP CONSTRAINT IF EXISTS ck_ai_task_snapshot_lineage_complete,
        DROP CONSTRAINT IF EXISTS fk_ai_task_superseded_by,
        DROP CONSTRAINT IF EXISTS fk_ai_task_snapshot_lineage,
        DROP CONSTRAINT IF EXISTS fk_ai_task_canvas_workspace,
        DROP CONSTRAINT IF EXISTS uq_ai_task_tenant_identity,
        DROP COLUMN IF EXISTS superseded_by_task_id,
        DROP COLUMN IF EXISTS canvas_revision,
        DROP COLUMN IF EXISTS snapshot_version,
        DROP COLUMN IF EXISTS snapshot_id,
        DROP COLUMN IF EXISTS canvas_id
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_ai_preview_snapshot_immutable ON ai_preview_snapshot`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_ai_preview_snapshot_immutable()`,
    );
    await queryRunner.query(`DROP TABLE ai_preview_snapshot`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_canvas_operation_client_revision`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_canvas_operation_tenant_revision`,
    );
    await queryRunner.query(`
      ALTER TABLE canvas_operation
        DROP CONSTRAINT IF EXISTS ck_canvas_operation_client_revision,
        DROP CONSTRAINT IF EXISTS ck_canvas_operation_phase04_scope,
        DROP CONSTRAINT IF EXISTS fk_canvas_operation_canvas_workspace,
        DROP CONSTRAINT IF EXISTS fk_canvas_operation_tenant_workspace,
        DROP COLUMN IF EXISTS client_revision,
        DROP COLUMN IF EXISTS workspace_id,
        DROP COLUMN IF EXISTS organization_id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_canvas_workspace`);
    await queryRunner.query(`
      ALTER TABLE canvas
        DROP CONSTRAINT IF EXISTS ck_canvas_background_color,
        DROP CONSTRAINT IF EXISTS ck_canvas_height_bounded,
        DROP CONSTRAINT IF EXISTS ck_canvas_width_bounded,
        DROP CONSTRAINT IF EXISTS ck_canvas_revision_nonnegative,
        DROP CONSTRAINT IF EXISTS uq_canvas_workspace_binding,
        DROP CONSTRAINT IF EXISTS fk_canvas_workspace,
        DROP COLUMN IF EXISTS background,
        DROP COLUMN IF EXISTS height,
        DROP COLUMN IF EXISTS width,
        DROP COLUMN IF EXISTS revision,
        DROP COLUMN IF EXISTS workspace_id
    `);

    await queryRunner.query(`
      UPDATE ai_task
      SET status = 'failed',
          error_code = COALESCE(error_code, 'PHASE_04_DOWNGRADE'),
          error_message = COALESCE(
            error_message,
            'Phase 04 lineage status removed during migration downgrade'
          )
      WHERE status::text IN ('superseded', 'stale')
    `);
    await queryRunner.query(
      `ALTER TABLE ai_task ALTER COLUMN status TYPE text USING status::text`,
    );
    await queryRunner.query(`DROP TYPE job_status_enum`);
    await queryRunner.query(`
      CREATE TYPE job_status_enum AS ENUM (
        'queued',
        'running',
        'waiting_for_user',
        'completed',
        'failed',
        'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE ai_task
      ALTER COLUMN status TYPE job_status_enum
      USING status::job_status_enum
    `);
  }
}
