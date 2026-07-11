import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationConstraints1700000024000 implements MigrationInterface {
  name = 'AddApplicationConstraints1700000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add schema_revision column to application table
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD COLUMN "schema_revision" integer NOT NULL DEFAULT 1
    `);

    // Unique constraint: application name within project scope
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD CONSTRAINT "uq_application_org_project_name"
        UNIQUE ("org_id", "project_id", "name")
    `);

    // Unique constraint: version numbers within an application
    await queryRunner.query(`
      ALTER TABLE "application_version"
        ADD CONSTRAINT "uq_application_version_number"
        UNIQUE ("application_id", "version_number")
    `);

    // Foreign key: application_version -> application with CASCADE delete
    await queryRunner.query(`
      ALTER TABLE "application_version"
        ADD CONSTRAINT "fk_application_version_application"
        FOREIGN KEY ("application_id")
        REFERENCES "application"("id")
        ON DELETE CASCADE
    `);

    // Check constraint: schema_revision must be positive
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD CONSTRAINT "ck_application_schema_revision"
        CHECK ("schema_revision" >= 1)
    `);

    // Check constraint: current_version must be non-negative
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD CONSTRAINT "ck_application_current_version"
        CHECK ("current_version" >= 0)
    `);

    // Check constraint: version_number must be positive
    await queryRunner.query(`
      ALTER TABLE "application_version"
        ADD CONSTRAINT "ck_app_version_number"
        CHECK ("version_number" >= 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "application_version" DROP CONSTRAINT "ck_app_version_number"`);
    await queryRunner.query(`ALTER TABLE "application" DROP CONSTRAINT "ck_application_current_version"`);
    await queryRunner.query(`ALTER TABLE "application" DROP CONSTRAINT "ck_application_schema_revision"`);
    await queryRunner.query(`ALTER TABLE "application_version" DROP CONSTRAINT "fk_application_version_application"`);
    await queryRunner.query(`ALTER TABLE "application_version" DROP CONSTRAINT "uq_application_version_number"`);
    await queryRunner.query(`ALTER TABLE "application" DROP CONSTRAINT "uq_application_org_project_name"`);
    await queryRunner.query(`ALTER TABLE "application" DROP COLUMN "schema_revision"`);
  }
}
