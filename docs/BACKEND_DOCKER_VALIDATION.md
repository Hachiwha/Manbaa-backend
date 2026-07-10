# Backend Docker Validation

Validation date: 2026-07-10  
Branch: `integration/backend-final`

## Commands Executed

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env build --no-cache backend backend-migrate
docker compose --env-file .env run --rm --no-deps backend node --version
docker compose --env-file .env run --rm --no-deps backend pnpm --version
docker compose --env-file .env --profile core up -d --force-recreate
docker compose --env-file .env ps
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deployment-smoke-test.ps1
docker compose --project-name flowforge-deployment-test --env-file .env --profile core up -d --build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deployment-smoke-test.ps1 -ProjectName flowforge-deployment-test
docker compose --project-name flowforge-deployment-test --env-file .env --profile core down
```

## Runtime Versions

- Node in image: `v20.20.2`
- pnpm in image: `9.15.9`

## Service Status

| Service | Configured | Built | Started | Health | Notes |
| --- | --- | --- | --- | --- | --- |
| `postgres` | yes | image pull | yes | healthy | pgvector image |
| `nats` | yes | image pull | yes | healthy | JetStream enabled |
| `nats-init` | yes | image pull | completed | ok | LF script fix required |
| `redis` | yes | image pull | yes | healthy | Redis 7.4 |
| `minio` | yes | image pull | yes | healthy | API and console exposed |
| `minio-init` | yes | image pull | completed | ok | Creates document/export/workspace buckets |
| `backend-migrate` | yes | yes | completed | ok | Ran all 21 migrations |
| `backend` | yes | yes | yes | healthy | `/api/health/ping` healthcheck |
| `ollama` | optional | absent in core | not started | disabled | `ai`/`full` profile |
| `ollama-init` | optional | absent in core | not started | disabled | `ai`/`full` profile |
| `elsa-db` | optional | absent in core | not started | disabled | `legacy` profile |
| `elsa-server` | optional | absent in core | not started | disabled | `legacy` profile |

Container names are project-scoped, for example `flowforge-backend-1` and `flowforge-deployment-test-backend-1`; the Compose file does not pin `container_name`.

## Health Results

- `/api/health/live`: `ok`
- `/api/health/ready`: `ok`
- `/api/health/ping`: `pong`
- `/api/health`: `ok`

Core dependencies in `/ready`:

- Postgres: up
- NATS: up
- Redis: up
- MinIO: up

## Issues Found And Fixed

- Docker Desktop daemon was initially unavailable; it was started.
- Alpine production build failed when bcrypt prebuilt download was unavailable; Dockerfiles now install `python3`, `make`, and `g++`.
- Mounted shell scripts failed with CRLF endings; `.gitattributes` now forces LF for `*.sh`.
- MinIO bootstrap initially created only document/export buckets; it now creates all configured workspace buckets.
- Duplicate NATS health durable caused backend startup error; `HealthService` now uses its own observer durable.
- Optional FastAPI/Ollama/Elsa/worker health no longer fails core aggregate health when disabled.
- Fixed Compose isolation by removing fixed `container_name` entries.
- Added deployment smoke tests for health, PostgreSQL, NATS, Redis, MinIO, auth registration, workspace creation, and AI task cancel.
- Updated NATS stream bootstrap to include canonical `workspace.*` subjects and to update existing streams. In the final isolated deployment, AI task outbox events were `published`.
