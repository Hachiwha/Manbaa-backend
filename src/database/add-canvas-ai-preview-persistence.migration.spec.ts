import { QueryRunner } from "typeorm";

import { AddCanvasAiPreviewPersistence1700000021000 } from "./migrations/1700000021000-AddCanvasAiPreviewPersistence";

describe("AddCanvasAiPreviewPersistence1700000021000", () => {
  function queryRunner() {
    const queries: string[] = [];
    return {
      queries,
      runner: {
        query: jest.fn(async (sql: string) => {
          queries.push(sql);
        }),
      } as unknown as QueryRunner,
    };
  }

  it("creates immutable tenant-safe snapshot and task lineage persistence", async () => {
    const { queries, runner } = queryRunner();
    await new AddCanvasAiPreviewPersistence1700000021000().up(runner);
    const sql = queries.join("\n");

    expect(sql).toContain("CREATE TABLE ai_preview_snapshot");
    expect(sql).toContain("trg_ai_preview_snapshot_immutable");
    expect(sql).toContain("uq_ai_preview_snapshot_canvas_version");
    expect(sql).toContain("fk_ai_task_snapshot_lineage");
    expect(sql).toContain("ADD COLUMN workspace_id uuid");
    expect(sql).toContain("ADD COLUMN client_revision bigint");
    expect(sql).not.toContain("canvas_ai_preview_task");
  });

  it("rebuilds the job status enum to its exact pre-Phase04 values on downgrade", async () => {
    const { queries, runner } = queryRunner();
    await new AddCanvasAiPreviewPersistence1700000021000().down(runner);
    const sql = queries.join("\n");

    expect(sql).toContain("DROP TABLE ai_preview_snapshot");
    expect(sql).toContain("DROP TYPE job_status_enum");
    expect(sql).toContain("CREATE TYPE job_status_enum AS ENUM");
    expect(sql).toContain("'cancelled'");
    const recreatedEnum = sql.slice(sql.indexOf("CREATE TYPE job_status_enum"));
    expect(recreatedEnum).not.toContain("'superseded'");
    expect(recreatedEnum).not.toContain("'stale'");
  });
});
