import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformIdentityFoundation1700000011000 implements MigrationInterface {
  name = 'AddPlatformIdentityFoundation1700000011000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE organization_role_enum AS ENUM ('owner','admin','member','billing')`);
    await queryRunner.query(`CREATE TABLE organization_member (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role organization_role_enum NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_organization_member UNIQUE (organization_id, user_id)
    )`);
    await queryRunner.query(`INSERT INTO organization_member (organization_id, user_id, role)
      SELECT org_id, id, CASE WHEN role = 'admin' THEN 'owner'::organization_role_enum ELSE 'member'::organization_role_enum END FROM "user"
      ON CONFLICT DO NOTHING`);
    await queryRunner.query(`ALTER TABLE refresh_token ADD COLUMN family_id uuid`);
    await queryRunner.query(`UPDATE refresh_token SET family_id = id WHERE family_id IS NULL`);
    await queryRunner.query(`ALTER TABLE refresh_token ALTER COLUMN family_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE refresh_token ADD COLUMN replaced_by_token_id uuid REFERENCES refresh_token(id)`);
    await queryRunner.query(`ALTER TABLE refresh_token ADD COLUMN revoked_at timestamptz`);
    await queryRunner.query(`CREATE INDEX idx_refresh_token_family ON refresh_token(family_id)`);
    await queryRunner.query(`ALTER TABLE "user"
      ADD COLUMN password_reset_token_hash text,
      ADD COLUMN password_reset_expires_at timestamptz,
      ADD COLUMN email_verification_token_hash text,
      ADD COLUMN email_verification_expires_at timestamptz`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE organization_member`);
    await queryRunner.query(`DROP TYPE organization_role_enum`);
    await queryRunner.query(`ALTER TABLE refresh_token DROP COLUMN revoked_at, DROP COLUMN replaced_by_token_id, DROP COLUMN family_id`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN password_reset_token_hash, DROP COLUMN password_reset_expires_at, DROP COLUMN email_verification_token_hash, DROP COLUMN email_verification_expires_at`);
  }
}
