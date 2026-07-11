import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShareColumnsToWorkflow1700000020000 implements MigrationInterface {
  name = 'AddShareColumnsToWorkflow1700000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workflow
        ADD COLUMN IF NOT EXISTS share_token text,
        ADD COLUMN IF NOT EXISTS share_expires_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS share_max_views integer,
        ADD COLUMN IF NOT EXISTS share_view_count integer NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workflow
        DROP COLUMN IF EXISTS share_view_count,
        DROP COLUMN IF EXISTS share_max_views,
        DROP COLUMN IF EXISTS share_expires_at,
        DROP COLUMN IF EXISTS share_token;
    `);
  }
}
