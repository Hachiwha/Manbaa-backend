# Environment Variables

This backend supports two local modes:

- Host-local: NestJS runs on the host and infrastructure runs in Docker.
- Docker core: NestJS and infrastructure run in Docker Compose.

Secrets in `.env` must be generated locally and must not be committed. The checked-in examples use placeholders only.

| Variable | Required | Secret | Host value | Docker value | Default | Consumer | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | yes | no | `development` | `development` | none | Nest config | canonical |
| `PORT` | yes | no | `3000` | `3000` | `3000` | Nest bootstrap | canonical |
| `NESTJS_PORT` | optional | no | `3000` | `3000` | `3000` | Compose port mapping | canonical |
| `ENABLE_SWAGGER` | optional | no | `true` | `true` | enabled unless `false` | Nest bootstrap | canonical |
| `LOG_LEVEL` | optional | no | `info` | `info` | `info` | pino logger | canonical |
| `CORS_ORIGIN` | optional | no | `http://localhost:3001` | `http://localhost:3001` | `http://localhost:3001` | Nest bootstrap | canonical |
| `DEV_BYPASS_AUTH` | optional | no | `false` | `false` | `false` | JWT guard/bootstrap | canonical |
| `THROTTLE_TTL` | optional | no | `60` | `60` | `60` | Throttler | canonical |
| `THROTTLE_LIMIT` | optional | no | `120` | `120` | `120` | Throttler | canonical |
| `APP_DB_NAME` | yes | no | `appdb` | `appdb` | `appdb` | Compose/seed | canonical |
| `APP_DB_USER` | yes | no | `app` | `app` | `app` | Compose/seed | canonical |
| `APP_DB_PASSWORD` | yes | yes | generated | generated | none | Compose/seed | canonical |
| `APP_DB_PORT` | optional | no | `5432` | `5432` | `5432` | Compose/seed | canonical |
| `DATABASE_URL` | yes | yes | `postgres://app:<secret>@localhost:5432/appdb` | `postgres://app:<secret>@postgres:5432/appdb` | none | TypeORM runtime | canonical |
| `MIGRATION_DATABASE_URL` | optional | yes | host Postgres URL | container Postgres URL | `DATABASE_URL` | TypeORM migrations | canonical |
| `NATS_URL` | yes | no | `nats://localhost:4222` | `nats://nats:4222` | none | NATS client | canonical |
| `NATS_STREAM_NAME` | optional | no | `FLOWFORGE` | `FLOWFORGE` | `FLOWFORGE` | NATS client/bootstrap | canonical |
| `NATS_PORT` | optional | no | `4222` | `4222` | `4222` | Compose | canonical |
| `NATS_MONITOR_PORT` | optional | no | `8222` | `8222` | `8222` | Compose | canonical |
| `REDIS_URL` | yes | no | `redis://localhost:6379` | `redis://redis:6379` | `redis://localhost:6379` | Redis service | canonical |
| `REDIS_CONNECT_TIMEOUT_MS` | optional | no | `5000` | `5000` | `5000` | Redis service | canonical |
| `REDIS_KEY_PREFIX` | optional | no | `platform:` | `platform:` | `platform:` | Redis service | canonical |
| `JWT_ACCESS_SECRET` | yes | yes | generated | generated | none | Auth/JWT | canonical |
| `JWT_REFRESH_SECRET` | yes | yes | generated | generated | none | Auth/JWT | canonical |
| `JWT_ACCESS_TTL` | optional | no | `15m` | `15m` | `15m` | Auth service | canonical |
| `JWT_REFRESH_TTL` | optional | no | `7d` | `7d` | `7d` | Auth service | canonical |
| `INTERNAL_AUTH_SECRET` | yes | yes | generated | generated | none | Worker JWT | canonical |
| `INTERNAL_AUTH_PREVIOUS_SECRET` | optional | yes | blank or previous secret | blank or previous secret | blank | Worker JWT | canonical |
| `INTERNAL_AUTH_ISSUER` | optional | no | `nestjs-platform` | `nestjs-platform` | `nestjs-platform` | Worker JWT | canonical |
| `INTERNAL_AUTH_AUDIENCE` | optional | no | `fastapi-workers` | `fastapi-workers` | `fastapi-workers` | Worker JWT | canonical |
| `INTERNAL_AUTH_ALLOWED_SERVICES` | optional | no | worker list | worker list | bundled worker list | Worker JWT | canonical |
| `INTERNAL_AUTH_TOKEN_TTL_SECONDS` | optional | no | `300` | `300` | `300` | Worker JWT | canonical |
| `MINIO_ENDPOINT` | yes | no | `localhost` | `minio` | none | MinIO clients | canonical |
| `MINIO_PORT` | optional | no | `9000` | `9000` | `9000` | MinIO clients | canonical |
| `MINIO_API_PORT` | optional | no | `9000` | `9000` | `9000` | Compose | canonical |
| `MINIO_CONSOLE_PORT` | optional | no | `9001` | `9001` | `9001` | Compose | canonical |
| `MINIO_USE_SSL` | optional | no | `false` | `false` | `false` | MinIO clients | canonical |
| `MINIO_ROOT_USER` | yes for Docker | no | `minio` | `minio` | `minio` | MinIO container/init | canonical |
| `MINIO_ROOT_PASSWORD` | yes for Docker | yes | generated | generated | none | MinIO container/init | canonical |
| `MINIO_ACCESS_KEY` | yes | no | `minio` | `minio` | none | Backend MinIO client | canonical |
| `MINIO_SECRET_KEY` | yes | yes | generated | generated | none | Backend MinIO client | canonical |
| `MINIO_BUCKET_NAME` | optional | no | `documents` | `documents` | `documents` | legacy alias/docs | legacy |
| `MINIO_BUCKET_DOCUMENTS` | optional | no | `documents` | `documents` | `documents` | Document storage | canonical |
| `MINIO_BUCKET_EXPORTS` | optional | no | `exports` | `exports` | `exports` | Export storage/docs | canonical |
| `MINIO_BUCKET_SOURCES` | optional | no | `workspace-sources` | `workspace-sources` | `workspace-sources` | Workspace storage | canonical |
| `MINIO_BUCKET_PREVIEWS` | optional | no | `workspace-previews` | `workspace-previews` | `workspace-previews` | Workspace storage | canonical |
| `MINIO_BUCKET_ASSETS` | optional | no | `workspace-assets` | `workspace-assets` | `workspace-assets` | Workspace/asset storage | canonical |
| `MINIO_BUCKET_WORKSPACE_EXPORTS` | optional | no | `workspace-exports` | `workspace-exports` | `workspace-exports` | Workspace storage | canonical |
| `MINIO_BUCKET_SNAPSHOTS` | optional | no | `workspace-snapshots` | `workspace-snapshots` | `workspace-snapshots` | Workspace storage | canonical |
| `MINIO_BUCKET_TEMP` | optional | no | `workspace-temp` | `workspace-temp` | `workspace-temp` | Workspace storage | canonical |
| `FASTAPI_ENABLED` | optional | no | `false` | `false` | `false` | Health classification | canonical |
| `FASTAPI_PORT` | optional | no | `8000` | `8000` | `8000` | Compose/docs | canonical |
| `FASTAPI_HEALTH_URL` | optional | no | `http://localhost:8000/health` | `http://ai-service:8000/health` | none | Health indicator | canonical |
| `FASTAPI_INTERNAL_URL` | optional | no | `http://localhost:8000/internal` | `http://ai-service:8000/internal` | none | Worker integration | canonical |
| `FASTAPI_URL` | optional | no | root FastAPI URL | root FastAPI URL | none | Skills embedding fallback compatibility | legacy |
| `OLLAMA_ENABLED` | optional | no | `false` | `false` | `false` | Health classification | canonical |
| `OLLAMA_URL` | optional | no | `http://localhost:11434` | `http://ollama:11434` | none | Ollama health/docs | canonical |
| `OLLAMA_PORT` | optional | no | `11434` | `11434` | `11434` | Compose/docs | canonical |
| `OLLAMA_LLM_MODEL` | optional | no | model name | model name | none | Pull script/docs | optional |
| `OLLAMA_EMBED_MODEL` | optional | no | model name | model name | none | Pull script/docs | optional |
| `ELSA_ENABLED` | optional | no | `false` | `false` | `false` | Health classification | canonical |
| `ELSA_HEALTH_URL` | optional | no | `http://localhost:5000/health` | `http://elsa-server:8080/health` | none | Elsa health | canonical |
| `NESTJS_CONTEXT` | optional | no | `.` | `.` | `.` | Compose build | canonical |
| `NESTJS_DOCKERFILE` | optional | no | `Dockerfile` | `Dockerfile` | `Dockerfile` | Compose build | canonical |
| `FASTAPI_CONTEXT` | optional | no | `./ai-service` | `./ai-service` | none | cross-repo compose docs | unused here |
| `NEXTJS_CONTEXT` | optional | no | `./frontend` | `./frontend` | none | cross-repo compose docs | unused here |
| `NEXTJS_PORT` | optional | no | `3001` | `3001` | `3001` | frontend docs | unused here |
| `NEXT_PUBLIC_API_URL` | optional | no | browser URL | browser URL | none | frontend docs | unused here |
| `NEXT_PUBLIC_WS_URL` | optional | no | browser WS URL | browser WS URL | none | frontend docs | unused here |
| `NEXT_PUBLIC_ELSA_URL` | optional | no | browser URL | browser URL | none | frontend docs | unused here |

## Notes

- In the current Docker Compose model, the backend uses the MinIO root account. Keep `MINIO_SECRET_KEY` aligned with `MINIO_ROOT_PASSWORD` unless a separate MinIO service account is added.
- `FASTAPI_ENABLED=false`, `OLLAMA_ENABLED=false`, and `ELSA_ENABLED=false` keep optional integrations from failing aggregate core health.
- Container-to-container URLs use service names; browser-facing URLs use `localhost`.
