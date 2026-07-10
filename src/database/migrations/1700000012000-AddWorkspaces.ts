import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddWorkspaces1700000012000 implements MigrationInterface {
  name = 'AddWorkspaces1700000012000';
  async up(q: QueryRunner) {
    await q.query(`CREATE TYPE workspace_stage_enum AS ENUM ('created','onboarding','collecting_sources','researching','strategy_ready','designing','concept_review','brand_system_ready','exported','archived')`);
    await q.query(`CREATE TYPE workspace_role_enum AS ENUM ('owner','admin','editor','commenter','viewer')`);
    await q.query(`CREATE TYPE workspace_member_status_enum AS ENUM ('active','suspended','removed')`);
    await q.query(`CREATE TABLE workspace (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organization(id), name text NOT NULL, description text, stage workspace_stage_enum NOT NULL DEFAULT 'created', thumbnail_asset_id uuid, settings jsonb NOT NULL DEFAULT '{}', created_by uuid NOT NULL REFERENCES "user"(id), archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`);
    await q.query(`CREATE INDEX idx_workspace_organization ON workspace(organization_id) WHERE deleted_at IS NULL`);
    await q.query(`CREATE TABLE workspace_member (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organization(id), workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES "user"(id), role workspace_role_enum NOT NULL, status workspace_member_status_enum NOT NULL DEFAULT 'active', invited_by uuid REFERENCES "user"(id), joined_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT uq_workspace_member UNIQUE(workspace_id,user_id))`);
    await q.query(`CREATE INDEX idx_workspace_member_access ON workspace_member(user_id,workspace_id,status)`);
  }
  async down(q: QueryRunner) { await q.query(`DROP TABLE workspace_member`); await q.query(`DROP TABLE workspace`); await q.query(`DROP TYPE workspace_member_status_enum`); await q.query(`DROP TYPE workspace_role_enum`); await q.query(`DROP TYPE workspace_stage_enum`); }
}
