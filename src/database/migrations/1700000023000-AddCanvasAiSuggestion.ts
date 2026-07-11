import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanvasAiSuggestion1700000023000 implements MigrationInterface {
  name = 'AddCanvasAiSuggestion1700000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE canvas_ai_suggestion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL,
        organization_id uuid NOT NULL,
        workspace_id uuid NOT NULL,
        canvas_id uuid NOT NULL,
        snapshot_id uuid,
        snapshot_version integer,
        canvas_revision bigint,
        result_type varchar(32) NOT NULL,
        component_spec jsonb,
        asset_id uuid,
        asset_version_id uuid,
        status varchar(32) NOT NULL DEFAULT 'queued',
        enhanced_prompt text,
        evidence_ids jsonb,
        stale boolean NOT NULL DEFAULT false,
        accepted_at timestamptz,
        rejected_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_suggestion_tenant ON canvas_ai_suggestion (organization_id, workspace_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_suggestion_canvas ON canvas_ai_suggestion (canvas_id, snapshot_version);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ai_suggestion_task ON canvas_ai_suggestion (task_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_suggestion_task`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_suggestion_canvas`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_suggestion_tenant`);
    await queryRunner.query(`DROP TABLE IF EXISTS canvas_ai_suggestion`);
  }
}
