import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCanvasTables1700000010500 implements MigrationInterface {
  name = "AddCanvasTables1700000010500";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS canvas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id uuid NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_canvas_workflow_id UNIQUE (workflow_id)
      );

      CREATE TABLE IF NOT EXISTS canvas_object (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        canvas_id uuid NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
        type varchar(64) NOT NULL,
        elsa_type varchar(128),
        label varchar(256),
        properties jsonb NOT NULL DEFAULT '{}',
        position_x double precision NOT NULL DEFAULT 0,
        position_y double precision NOT NULL DEFAULT 0,
        width double precision,
        height double precision,
        style jsonb,
        is_locked boolean NOT NULL DEFAULT false,
        created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS canvas_operation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        canvas_id uuid NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
        canvas_object_id uuid REFERENCES canvas_object(id) ON DELETE SET NULL,
        user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        op_type varchar(64) NOT NULL,
        op_payload jsonb NOT NULL DEFAULT '{}',
        version_vector jsonb,
        sequence_number bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS canvas_snapshot (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        canvas_id uuid NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
        snapshot_data jsonb NOT NULL DEFAULT '{}',
        created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
        trigger varchar(64) NOT NULL DEFAULT 'manual',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS canvas_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        canvas_id uuid NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
        workflow_version_id uuid REFERENCES workflow_version(id) ON DELETE SET NULL,
        snapshot_id uuid REFERENCES canvas_snapshot(id) ON DELETE SET NULL,
        label varchar(256),
        type varchar(32) NOT NULL DEFAULT 'draft',
        created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_canvas_workflow ON canvas (workflow_id);
      CREATE INDEX IF NOT EXISTS idx_canvas_object_canvas ON canvas_object (canvas_id);
      CREATE INDEX IF NOT EXISTS idx_canvas_object_type ON canvas_object (canvas_id, type);
      CREATE INDEX IF NOT EXISTS idx_canvas_operation_canvas_seq ON canvas_operation (canvas_id, sequence_number);
      CREATE INDEX IF NOT EXISTS idx_canvas_operation_object ON canvas_operation (canvas_object_id) WHERE canvas_object_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_canvas_operation_user ON canvas_operation (user_id);
      CREATE INDEX IF NOT EXISTS idx_canvas_snapshot_canvas ON canvas_snapshot (canvas_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_canvas_version_canvas ON canvas_version (canvas_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_canvas_version_workflow_version ON canvas_version (workflow_version_id) WHERE workflow_version_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_canvas_version_workflow_version;
      DROP INDEX IF EXISTS idx_canvas_version_canvas;
      DROP INDEX IF EXISTS idx_canvas_snapshot_canvas;
      DROP INDEX IF EXISTS idx_canvas_operation_user;
      DROP INDEX IF EXISTS idx_canvas_operation_object;
      DROP INDEX IF EXISTS idx_canvas_operation_canvas_seq;
      DROP INDEX IF EXISTS idx_canvas_object_type;
      DROP INDEX IF EXISTS idx_canvas_object_canvas;
      DROP INDEX IF EXISTS idx_canvas_workflow;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS canvas_version CASCADE;
      DROP TABLE IF EXISTS canvas_snapshot CASCADE;
      DROP TABLE IF EXISTS canvas_operation CASCADE;
      DROP TABLE IF EXISTS canvas_object CASCADE;
      DROP TABLE IF EXISTS canvas CASCADE;
    `);
  }
}
