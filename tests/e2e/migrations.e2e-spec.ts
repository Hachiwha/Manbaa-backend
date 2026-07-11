import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('Migrations (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('testdb')
      .withUsername('test')
      .withPassword('test')
      .withExposedPorts(5432)
      .start();
  }, 120_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('enables required extensions', async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: 'testdb',
      username: 'test',
      password: 'test',
      synchronize: false,
      migrationsRun: false,
      namingStrategy: new SnakeNamingStrategy(),
      entities: [__dirname + '/../../src/modules/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../../src/database/migrations/*{.ts,.js}'],
    });

    await dataSource.initialize();

    await dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS citext');

    const extensions = await dataSource.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pgcrypto', 'citext') ORDER BY extname",
    );
    expect(extensions.map((r: any) => r.extname)).toEqual(['citext', 'pgcrypto', 'vector']);
  }, 60_000);

  it('runs all migrations from empty database', async () => {
    const migrations = await dataSource.runMigrations({ transaction: 'each' });
    expect(migrations.length).toBeGreaterThanOrEqual(25);

    const tables = await dataSource.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const tableNames = tables.map((r: any) => r.tablename);
    expect(tableNames).toContain('application');
    expect(tableNames).toContain('application_version');
    expect(tableNames).toContain('organization');
    expect(tableNames).toContain('user');
    expect(tableNames).toContain('workflow');
  }, 120_000);

  it('creates expected application table structure', async () => {
    const columns = await dataSource.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'application'
       ORDER BY ordinal_position`,
    );

    const colNames = columns.map((c: any) => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('org_id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('status');
    expect(colNames).toContain('draft_schema');
    expect(colNames).toContain('schema_revision');
    expect(colNames).toContain('current_version');
    expect(colNames).toContain('published_version_id');
  }, 30_000);

  it('creates expected application indexes', async () => {
    const indexes = await dataSource.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'application'
       ORDER BY indexname`,
    );

    const idxNames = indexes.map((r: any) => r.indexname);
    expect(idxNames).toContain('idx_application_org_id');
    expect(idxNames).toContain('idx_application_project_id');
    expect(idxNames).toContain('uq_application_org_project_name');
  }, 30_000);

  it('creates application_version with unique constraint', async () => {
    // runMigrations may have already been called; skip if so
    if (!dataSource.isInitialized) return;

    // Query constraints on application_version
    const constraints = await dataSource.query(
      `SELECT conname, contype FROM pg_constraint
       WHERE conrelid = 'application_version'::regclass
       ORDER BY conname`,
    );

    const constraintNames = constraints.map((r: any) => r.conname);
    expect(constraintNames).toContain('uq_application_version_number');
    expect(constraintNames).toContain('fk_application_version_application');
  }, 30_000);

  it('creates application_status_enum', async () => {
    const enums = await dataSource.query(
      "SELECT typname FROM pg_type WHERE typname = 'application_status_enum'",
    );
    expect(enums.length).toBe(1);

    const enumValues = await dataSource.query(
      `SELECT enumlabel FROM pg_enum
       WHERE enumtypid = 'application_status_enum'::regtype
       ORDER BY enumsortorder`,
    );
    expect(enumValues.map((r: any) => r.enumlabel)).toEqual(['draft', 'published', 'archived']);
  }, 30_000);

  describe('migration reversibility', () => {
    it('reverts then reruns all migrations', async () => {
      // Revert all
      while (dataSource.migrations.length > 0) {
        await dataSource.undoLastMigration({ transaction: 'each' });
      }

      // Verify tables are gone
      const tables = await dataSource.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      expect(tables.length).toBe(0);

      // Rerun all
      const rerunMigrations = await dataSource.runMigrations({ transaction: 'each' });
      expect(rerunMigrations.length).toBeGreaterThanOrEqual(25);

      // Verify tables are back
      const tablesAfterRerun = await dataSource.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      expect(tablesAfterRerun.map((r: any) => r.tablename)).toContain('application');
    }, 180_000);
  });

  it('DataSource initializes successfully after migrations', async () => {
    expect(dataSource.isInitialized).toBe(true);
    await dataSource.query('SELECT 1');
  });
});
