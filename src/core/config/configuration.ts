export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  nats: {
    url: process.env.NATS_URL,
    streamName: process.env.NATS_STREAM_NAME,
    user: process.env.NATS_USER,
    password: process.env.NATS_PASSWORD,
  },
  redis: { url: process.env.REDIS_URL, connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS,10)||5000, keyPrefix: process.env.REDIS_KEY_PREFIX||'platform:' },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL,
    refreshTtl: process.env.JWT_REFRESH_TTL,
  },
  internalAuth: { issuer: process.env.INTERNAL_AUTH_ISSUER||'nestjs-platform', audience: process.env.INTERNAL_AUTH_AUDIENCE||'fastapi-workers', currentSecret: process.env.INTERNAL_AUTH_SECRET, previousSecret: process.env.INTERNAL_AUTH_PREVIOUS_SECRET, allowedServices:(process.env.INTERNAL_AUTH_ALLOWED_SERVICES||'ai-orchestrator,document-worker,research-worker,media-worker,export-worker').split(',') },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucketDocuments: process.env.MINIO_BUCKET_DOCUMENTS,
    bucketExports: process.env.MINIO_BUCKET_EXPORTS,
  },
  ollama: {
    url: process.env.OLLAMA_URL,
  },
  health: {
    fastapi: process.env.FASTAPI_HEALTH_URL,
    fastapiInternal: process.env.FASTAPI_INTERNAL_URL,
    elsa: process.env.ELSA_HEALTH_URL,
  },
  corsOrigin: process.env.CORS_ORIGIN,
  devBypassAuth: process.env.DEV_BYPASS_AUTH === 'true',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 120,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
});
