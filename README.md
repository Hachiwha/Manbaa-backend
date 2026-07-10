# ppp-backend — Process Elicitation API

NestJS + TypeORM + PostgreSQL/pgvector backend for the PPP platform.

## Tech Stack

- **Framework:** NestJS 10 (TypeScript 5.3)
- **Database:** PostgreSQL 16 + pgvector via TypeORM
- **Message Bus:** NATS JetStream 2.10
- **Object Storage:** MinIO (S3-compatible)
- **Auth:** Passport/JWT
- **Realtime:** Socket.IO 4.8
- **Validation:** class-validator + class-transformer
- **API Docs:** Swagger/OpenAPI at `/api/docs`

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d app-db nats minio ollama
pnpm migration:run
pnpm start:dev
```

Health: `http://localhost:3000/api/health/ping`

## Architecture

```
[React Client] <--REST/WS--> [NestJS Gateway] <--NATS--> [FastAPI AI Worker]
                                  |                          |
                             [PostgreSQL+pgvector]        [Ollama LLM]
                                  |
                             [MinIO S3]
```

The backend is a **modular monolith** with **16 domain modules** coordinated through NATS JetStream for async AI processing.

## Modules

| Module | Purpose |
|--------|---------|
| Workflows | CRUD, immutable versions, BPMN/PDF/Elsa export |
| Sessions | Elicitation FSM (10 states) |
| AI Gateway | Pipeline orchestration via NATS |
| Documents | Upload, MinIO storage, preprocessing |
| Messages | Conversation history |
| Skills | Reusable knowledge libraries |
| Rules | Configurable business rules |
| Audit | Immutable audit trail |
| Realtime | Socket.IO + NATS-WS bridge |
| Health | 6 dependency indicators |
| Organizations | Multi-tenant management |
| Auth | JWT + refresh tokens |
| Agents | AI agent definitions & execution |
| Divergence | Graph comparison |
| Comments | Workflow annotations |
| Projects | Workflow grouping |

## Project Structure

```
├── src/
│   ├── main.ts               # Bootstrap
│   ├── app.module.ts         # Root module
│   ├── core/                 # Cross-cutting (config, guards, decorators, messaging)
│   ├── database/             # TypeORM config, migrations, enums
│   ├── infra/                # NATS client
│   └── modules/              # 16 domain modules
├── docs/
├── infra/                    # Dockerfiles, init scripts
├── scripts/                  # Smoke tests, model pull
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Commands

```bash
pnpm build          # Build
pnpm lint           # Lint
pnpm test           # Tests
pnpm migration:run  # Apply migrations
pnpm migration:generate -- <name>  # New migration
./scripts/smoke.sh  # Smoke tests
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `NATS_URL` | No | `nats://localhost:4222` | NATS server URL |
| `MINIO_ENDPOINT` | No | `localhost:9000` | MinIO endpoint |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama URL |
| `SERVICE_TOKEN` | Yes | — | Shared service auth token |
| `DEV_BYPASS_AUTH` | No | `false` | Bypass auth in dev |
