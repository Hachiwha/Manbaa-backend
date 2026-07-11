# ppp-backend - FlowForge Process Elicitation API

NestJS + TypeORM + PostgreSQL/pgvector backend for the PPP / FlowForge platform.

The backend provides versioned authentication, organizations, workspaces, invitations, centralized workspace permissions, workflows, sessions, messages, documents, rules, skills, audit logs, notifications, usage tracking, AI task orchestration, transactional NATS outbox delivery, Redis-backed realtime support, canvas collaboration, concepts, assets, MinIO storage, and health checks.

## Tech Stack

- Node 20, pnpm 9.15.9
- NestJS 10, TypeScript
- PostgreSQL 16 + pgvector via TypeORM
- NATS JetStream
- Redis
- MinIO
- Socket.IO
- Swagger/OpenAPI
- Jest, Supertest, Python contract tests
- Docker Compose

## Quick Start

```bash
pnpm install --frozen-lockfile
cp .env.docker.example .env
# replace placeholder secrets in .env
docker compose --env-file .env --profile core up -d
pnpm migration:validate
```

PowerShell helpers are available on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-env.ps1 .env
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-health.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deployment-smoke-test.ps1
```

## Local URLs

- API base: `http://localhost:3000/api`
- Health live: `http://localhost:3000/api/health/live`
- Health ready: `http://localhost:3000/api/health/ready`
- Health aggregate: `http://localhost:3000/api/health`
- Swagger UI: `http://localhost:3000/docs`
- Swagger JSON: `http://localhost:3000/docs-json`

## Core Docker Profile

```bash
docker compose --env-file .env --profile core up -d
docker compose --env-file .env ps
```

Core services:

- `postgres`
- `nats`
- `redis`
- `minio`
- `backend-migrate`
- `backend`

Optional profiles:

- `ai`: Ollama
- `legacy`: Elsa
- `full`: core plus optional services

FastAPI workers are not included in this repository. Keep `FASTAPI_ENABLED=false` unless real workers are deployed.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm run test -- --runInBand
pnpm test:e2e
pnpm build
pnpm test:contracts
pnpm migration:validate
docker compose --env-file .env config --quiet
```

## Architecture

```text
Client -> REST / Socket.IO -> NestJS -> PostgreSQL + pgvector
                              |
                              +-> NATS JetStream -> external workers
                              |
                              +-> Redis
                              |
                              +-> MinIO
```

The backend is a modular monolith. Async AI, RAG, media, and export execution are worker-dependent.

## Active Modules

- Auth
- Organizations
- Workspaces
- Projects
- Applications
- Workflows
- Sessions
- Messages
- Documents
- Skills
- Rules
- AI Gateway
- Jobs
- Outbox
- Notifications
- Usage
- Audit
- Realtime
- Canvas
- Comments
- Concepts
- Assets
- Health

## Current Validation Snapshot

Executed on 2026-07-11:

- Docker core stack healthy
- Clean isolated Compose deployment simulation passed
- Swagger JSON loads with 140+ paths (including new Applications API)
- 25 migrations validated (1 new: AddApplications)
- 51+ public database tables (2 new: application, application_version)
- Unit tests: 51 suites, 336 tests passing (21 new: applications module)
- E2E tests: 2 suites, 8 tests passing
- Contract tests: TypeScript and Python contract tests passing
- Applications CRUD, schema drafts, versions, publishing, duplication verified

See:

- `docs/DOCKER.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/BACKEND_FEATURE_VALIDATION.md`
- `docs/BACKEND_MIGRATION_STATUS.md`
- `docs/BACKEND_DOCKER_VALIDATION.md`
- `docs/DEPLOYMENT_READINESS_MATRIX.md`
- `docs/DEPLOYMENT_READINESS_REPORT.md`
