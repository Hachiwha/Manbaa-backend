/**
 * Module wiring tests verify NestJS module configuration without
 * starting infrastructure connections. The true runtime validation
 * is performed by Docker health checks and the deployment smoke test.
 */

describe('Module wiring', () => {
  it('AiTask is in CanvasModule TypeOrmModule.forFeature()', () => {
    const source = require('fs').readFileSync(
      require.resolve('../src/modules/canvas/canvas.module.ts'),
      'utf-8',
    );

    const forFeatureMatch = source.match(
      /TypeOrmModule\.forFeature\(\[([\s\S]*?)\]\)/,
    );
    expect(forFeatureMatch).not.toBeNull();
    expect(forFeatureMatch![1]).toContain('AiTask');
  });

  it('CanvasModule forFeature contains all required entities', () => {
    const source = require('fs').readFileSync(
      require.resolve('../src/modules/canvas/canvas.module.ts'),
      'utf-8',
    );

    const forFeatureMatch = source.match(
      /TypeOrmModule\.forFeature\(\[([\s\S]*?)\]\)/,
    );
    expect(forFeatureMatch).not.toBeNull();
    const body = forFeatureMatch![1];

    expect(body).toContain('Canvas');
    expect(body).toContain('CanvasObject');
    expect(body).toContain('CanvasOperation');
    expect(body).toContain('CanvasSnapshot');
    expect(body).toContain('CanvasVersion');
    expect(body).toContain('AiPreviewSnapshot');
    expect(body).toContain('CanvasAiSuggestion');
    expect(body).toContain('AiTask');
    expect(body).toContain('Workflow');
    expect(body).toContain('WorkflowVersion');
  });

  it('AiTask import comes from jobs/entities', () => {
    const source = require('fs').readFileSync(
      require.resolve('../src/modules/canvas/canvas.module.ts'),
      'utf-8',
    );

    expect(source).toContain('from "../jobs/entities/ai-task.entity"');
  });
});
