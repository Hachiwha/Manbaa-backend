import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConceptsAndAssets1700000018000 implements MigrationInterface {
  name = 'AddConceptsAndAssets1700000018000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE concept_status_enum AS ENUM ('draft','generating','generated','failed','evaluating','evaluated','approved','rejected','archived')`);
    await q.query(`CREATE TABLE concept (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL,
      description text,
      status concept_status_enum NOT NULL DEFAULT 'draft',
      prompt text,
      generation_params jsonb,
      result_data jsonb,
      evaluation_score double precision,
      evaluation_feedback text,
      version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL REFERENCES "user"(id),
      approved_by uuid REFERENCES "user"(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      approved_at timestamptz
    )`);
    await q.query(`CREATE INDEX idx_concept_workspace_status ON concept(workspace_id,status)`);
    await q.query(`CREATE INDEX idx_concept_org_workspace ON concept(organization_id,workspace_id)`);

    await q.query(`CREATE TYPE asset_type_enum AS ENUM ('image','svg','mockup','thumbnail','document')`);
    await q.query(`CREATE TYPE asset_status_enum AS ENUM ('draft','generating','generated','failed','approved','rejected')`);
    await q.query(`CREATE TABLE asset (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL,
      type asset_type_enum NOT NULL,
      status asset_status_enum NOT NULL DEFAULT 'draft',
      prompt text,
      generation_params jsonb,
      storage_key varchar,
      mime_type varchar(127),
      file_size integer,
      width integer,
      height integer,
      thumbnail_key varchar,
      metadata jsonb,
      version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL REFERENCES "user"(id),
      approved_by uuid REFERENCES "user"(id),
      parent_id uuid REFERENCES asset(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      approved_at timestamptz
    )`);
    await q.query(`CREATE INDEX idx_asset_workspace_status ON asset(workspace_id,status)`);
    await q.query(`CREATE INDEX idx_asset_org_workspace ON asset(organization_id,workspace_id)`);
    await q.query(`CREATE INDEX idx_asset_parent_version ON asset(parent_id,version)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX idx_asset_parent_version`);
    await q.query(`DROP INDEX idx_asset_org_workspace`);
    await q.query(`DROP INDEX idx_asset_workspace_status`);
    await q.query(`DROP TABLE asset`);
    await q.query(`DROP TYPE asset_status_enum`);
    await q.query(`DROP TYPE asset_type_enum`);
    await q.query(`DROP INDEX idx_concept_org_workspace`);
    await q.query(`DROP INDEX idx_concept_workspace_status`);
    await q.query(`DROP TABLE concept`);
    await q.query(`DROP TYPE concept_status_enum`);
  }
}
