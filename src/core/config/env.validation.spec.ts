import { envSchema } from './env.validation';

const validEnv = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgres://app:secret@localhost:5432/appdb',
  NATS_URL: 'nats://localhost:4222',
  NATS_STREAM_NAME: 'FLOWFORGE',
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  INTERNAL_AUTH_SECRET: 'internal-secret-with-at-least-32-chars',
  INTERNAL_AUTH_TOKEN_TTL_SECONDS: 300,
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_USE_SSL: false,
  MINIO_ACCESS_KEY: 'minio',
  MINIO_SECRET_KEY: 'minio-secret',
  MINIO_BUCKET_NAME: 'documents',
  MINIO_BUCKET_DOCUMENTS: 'documents',
  MINIO_BUCKET_EXPORTS: 'exports',
  MINIO_BUCKET_SOURCES: 'workspace-sources',
  MINIO_BUCKET_PREVIEWS: 'workspace-previews',
  MINIO_BUCKET_ASSETS: 'workspace-assets',
  MINIO_BUCKET_WORKSPACE_EXPORTS: 'workspace-exports',
  MINIO_BUCKET_SNAPSHOTS: 'workspace-snapshots',
  MINIO_BUCKET_TEMP: 'workspace-temp',
  AI_ENABLED: false,
  AI_ORCHESTRATOR_ENABLED: false,
  DOCUMENT_WORKER_ENABLED: false,
  MEDIA_WORKER_ENABLED: false,
  RESEARCH_WORKER_ENABLED: false,
  EXPORT_WORKER_ENABLED: false,
  FASTAPI_ENABLED: false,
  ELSA_ENABLED: false,
  FASTAPI_HEALTH_URL: 'http://localhost:8000/health',
  FASTAPI_INTERNAL_URL: 'http://localhost:8000/internal',
  FASTAPI_URL: '',
  ELSA_HEALTH_URL: 'http://localhost:5000/health',
  CORS_ORIGIN: 'http://localhost:3001',
  CANVAS_AI_AUTO_PREVIEW_ENABLED: false,
  CANVAS_AI_DEBOUNCE_MS: 3000,
  CANVAS_AI_MAX_DEBOUNCE_MS: 15000,
};

describe('envSchema', () => {
  it('rejects missing JWT access secret', () => {
    const env = { ...validEnv };
    delete env.JWT_ACCESS_SECRET;

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('accepts a complete BE-22 environment', () => {
    const result = envSchema.validate(validEnv, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value.NATS_STREAM_NAME).toBe('FLOWFORGE');
  });

  it('validates canvas AI debounce configuration', () => {
    const result = envSchema.validate(
      {
        ...validEnv,
        CANVAS_AI_AUTO_PREVIEW_ENABLED: 'true',
        CANVAS_AI_DEBOUNCE_MS: 2_000,
        CANVAS_AI_MAX_DEBOUNCE_MS: 10_000,
      },
      { abortEarly: false },
    );

    expect(result.error).toBeUndefined();
    expect(result.value.CANVAS_AI_AUTO_PREVIEW_ENABLED).toBe(true);
    expect(result.value.CANVAS_AI_DEBOUNCE_MS).toBe(2_000);
    expect(result.value.CANVAS_AI_MAX_DEBOUNCE_MS).toBe(10_000);
  });

  it('rejects a maximum debounce shorter than the normal debounce', () => {
    const result = envSchema.validate(
      {
        ...validEnv,
        CANVAS_AI_DEBOUNCE_MS: 5_000,
        CANVAS_AI_MAX_DEBOUNCE_MS: 4_999,
      },
      { abortEarly: false },
    );

    expect(result.error?.message).toContain('CANVAS_AI_MAX_DEBOUNCE_MS');
  });

  it('rejects missing JWT refresh secret', () => {
    const env = { ...validEnv };
    delete env.JWT_REFRESH_SECRET;

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error?.message).toContain('JWT_REFRESH_SECRET');
  });

  it('accepts AI_ENABLED without per-worker flags', () => {
    const env = { ...validEnv, AI_ENABLED: true };
    delete (env as any).AI_ORCHESTRATOR_ENABLED;
    delete (env as any).DOCUMENT_WORKER_ENABLED;
    delete (env as any).MEDIA_WORKER_ENABLED;
    delete (env as any).RESEARCH_WORKER_ENABLED;
    delete (env as any).EXPORT_WORKER_ENABLED;

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value.AI_ENABLED).toBe(true);
    expect(result.value.AI_ORCHESTRATOR_ENABLED).toBe(false);
  });

  it('accepts AI_ENABLED with explicit per-worker flags', () => {
    const env = {
      ...validEnv,
      AI_ENABLED: true,
      AI_ORCHESTRATOR_ENABLED: true,
      DOCUMENT_WORKER_ENABLED: true,
      MEDIA_WORKER_ENABLED: false,
      RESEARCH_WORKER_ENABLED: true,
      EXPORT_WORKER_ENABLED: false,
    };

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value.AI_ORCHESTRATOR_ENABLED).toBe(true);
    expect(result.value.DOCUMENT_WORKER_ENABLED).toBe(true);
    expect(result.value.MEDIA_WORKER_ENABLED).toBe(false);
    expect(result.value.RESEARCH_WORKER_ENABLED).toBe(true);
    expect(result.value.EXPORT_WORKER_ENABLED).toBe(false);
  });

  it('rejects missing JWT secrets with clear messages', () => {
    const env = { ...validEnv };
    delete (env as any).JWT_ACCESS_SECRET;
    delete (env as any).JWT_REFRESH_SECRET;
    delete (env as any).INTERNAL_AUTH_SECRET;

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error?.message).toContain('JWT_ACCESS_SECRET');
    expect(result.error?.message).toContain('JWT_REFRESH_SECRET');
    expect(result.error?.message).toContain('INTERNAL_AUTH_SECRET');
  });

  it('does not leak secret values in validation errors', () => {
    const env = { ...validEnv };
    delete env.NODE_ENV;

    const result = envSchema.validate(env, { abortEarly: false });

    expect(result.error?.message).not.toContain('access-secret');
    expect(result.error?.message).not.toContain('minio-secret');
    expect(result.error?.message).not.toContain('internal-secret');
  });
});
