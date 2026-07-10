# Docker

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2.
- Node 20 and pnpm 9.15.9 for host-side tests.
- A real `.env` copied from `.env.docker.example` with generated secrets.

## First Setup

```bash
cp .env.docker.example .env
```

Replace all placeholder secrets. Keep `DEV_BYPASS_AUTH=false`.

On this Windows machine, the PowerShell validation path is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-env.ps1 .env
```

## Secret Generation

Use a cryptographic random generator for:

- `APP_DB_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `INTERNAL_AUTH_SECRET`
- `MINIO_ROOT_PASSWORD`
- `MINIO_SECRET_KEY`

The current Compose setup uses the MinIO root account as the backend client, so `MINIO_SECRET_KEY` must match `MINIO_ROOT_PASSWORD` unless a separate MinIO user is added.

## Build

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env build backend backend-migrate
```

For a full clean image build:

```bash
docker compose --env-file .env build --no-cache backend backend-migrate
```

## Core Startup

```bash
docker compose --env-file .env --profile core up -d
docker compose --env-file .env ps
```

Core services:

- `postgres`
- `nats`
- `redis`
- `minio`
- `minio-init`
- `nats-init`
- `backend-migrate`
- `backend`

## Migrations

```bash
pnpm migration:validate
docker compose --env-file .env run --rm backend-migrate
```

The validated migration count is 21.

## Health Checks

```bash
curl -fsS http://localhost:3000/api/health/live
curl -fsS http://localhost:3000/api/health/ready
curl -fsS http://localhost:3000/api/health/ping
curl -fsS http://localhost:3000/api/health
```

PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-health.ps1
```

## Logs

```bash
docker compose --env-file .env logs --no-color --tail=300 backend
docker compose --env-file .env logs --no-color --tail=200 backend-migrate
docker compose --env-file .env logs --no-color --tail=150 postgres
docker compose --env-file .env logs --no-color --tail=150 nats
docker compose --env-file .env logs --no-color --tail=150 redis
docker compose --env-file .env logs --no-color --tail=150 minio
```

## Optional Profiles

- `core`: backend, database, NATS, Redis, MinIO.
- `ai`: infrastructure plus Ollama.
- `legacy`: Elsa server and Elsa database.
- `full`: core plus optional services.

FastAPI workers are not implemented in this repository. Keep `FASTAPI_ENABLED=false` unless real workers are deployed.

## Shutdown

```bash
docker compose --env-file .env --profile core down
```

## Safe Reset

Do not delete volumes automatically in scripts. For manual local reset only:

```bash
docker compose --env-file .env --profile core down
docker volume ls --filter name=flowforge
```

Delete volumes only after confirming no data is needed.

## Troubleshooting

- If shell scripts fail with `set: -\r`, ensure `*.sh` files use LF line endings. `.gitattributes` enforces this.
- If Docker build falls back to native bcrypt compilation, the Dockerfile includes `python3`, `make`, and `g++`.
- If `/api/health/ready` is down, inspect Postgres, NATS, Redis, and MinIO first.
- If `/api/health` reports optional services disabled, enable the corresponding service and set `FASTAPI_ENABLED`, `OLLAMA_ENABLED`, or `ELSA_ENABLED`.
