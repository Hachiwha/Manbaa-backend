import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplications1700000022000 implements MigrationInterface {
  name = 'AddApplications1700000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."application_status_enum" AS ENUM('draft', 'published', 'archived')`);

    await queryRunner.query(`
      CREATE TABLE "application" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "description" text,
        "status" "public"."application_status_enum" NOT NULL DEFAULT 'draft',
        "current_version" integer NOT NULL DEFAULT '0',
        "org_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "draft_schema" jsonb,
        "published_version_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "application_version" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "application_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "schema_version" character varying(20) NOT NULL,
        "schema" jsonb NOT NULL,
        "description" text,
        "is_published" boolean NOT NULL DEFAULT false,
        "published_at" TIMESTAMPTZ,
        "published_by" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_version_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_application_org_id" ON "application" ("org_id")`);
    await queryRunner.query(`CREATE INDEX "idx_application_project_id" ON "application" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "idx_app_version_application_id" ON "application_version" ("application_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_app_version_application_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_application_project_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_application_org_id"`);
    await queryRunner.query(`DROP TABLE "application_version"`);
    await queryRunner.query(`DROP TABLE "application"`);
    await queryRunner.query(`DROP TYPE "public"."application_status_enum"`);
  }
}
