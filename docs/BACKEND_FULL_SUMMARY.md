# FlowForge Backend — Full Summary

**Repository:** `ppp-backend` | **Branch:** `integration/backend-final`  
**Stack:** NestJS + TypeORM + PostgreSQL + NATS JetStream + Redis + MinIO

---

## Architecture

```
Client → Socket.IO / REST → NestJS → PostgreSQL (state)
                             ↓
                          NATS JetStream → FastAPI workers (AI, RAG, media)
                             ↓
                          Redis (cache, locks, realtime scaling)
                             ↓
                          MinIO (files, artifacts)
```

---

## Branches integrated

| Branch | Content |
|--------|---------|
| `feature/dev1-platform-final` | Auth, orgs, workspaces, members, invitations, audit, notifications, usage, AI tasks, outbox, NATS, Redis, MinIO, health |
| `origin/feat/canvas-batch-1` | Canvas persistence, CRUD, versioning |
| `origin/feat/canvas-batch-2` | Canvas realtime collaboration, room auth |
| `feature/dev3-integrated-final` | Concepts module, assets module, expanded subjects, Docker/pnpm fix, docker-compose profiles |

---

## Domain status

| Domain | Status | Details |
|--------|--------|---------|
| **Auth** | ✅ | Register, login, refresh-token rotation, logout-all, JWT, password hashing |
| **Organizations** | ✅ | CRUD, members, roles, last-owner protection, cross-org denial |
| **Workspaces** | ✅ | CRUD, archive/restore, optimistic versioning, membership filtering |
| **Workspace Members** | ✅ | List, role change, suspend/restore, remove, Socket.IO revocation |
| **Invitations** | ✅ | Create, revoke, accept, expiration, idempotency |
| **Audit** | ✅ | Append-only log for all domain mutations |
| **Notifications** | ✅ | List, mark read, mark-all-read, per-domain types |
| **Usage/Quotas** | ✅ | Reserve, commit, release, idempotency, quota exceeded |
| **AI Tasks** | ✅ | Create, cancel, progress, completion, failure, outbox, usage settlement, realtime |
| **Outbox** | ✅ | Transactional insert, poll, lock, publish, retry, dead-letter |
| **NATS** | ✅ | Stream bootstrap, subject registry, consumers, graceful shutdown, health |
| **Redis** | ✅ | Shared client, locks, replay protection, heartbeats, Socket.IO adapter, health |
| **MinIO** | ⚠️ | Bucket init, signed upload/download, path validation, traversal rejection — needs `MINIO_BUCKET_NAME` env |
| **Internal Worker Auth** | ✅ | JWT with expiry, audience, issuer, replay prevention |
| **Realtime** | ✅ | Socket.IO with Redis adapter, room auth (user/org/workspace/canvas/ai-task), member revocation |
| **Health** | ✅ | `/api/health/live`, `/ready`, `/ping`, `/health`, per-service indicators |
| **Canvas** | ✅ | CRUD, objects, operations, snapshots, versions, realtime collaboration |
| **Concepts** | ✅ | Entity, DTO, service, controller |
| **Assets** | ✅ | Entity, DTO (with versions) |
| **Export subjects** | ✅ | Registered in NATS subject registry |

---

## Migrations

**20 total,** all uniquely ordered:

- 8 legacy (Init → MessageSearchIndexes)
- 1 Canvas (`1700000010500-AddCanvasTables`)
- 7 Dev 1 platform (`1700000011000`–`1700000017000`: IdentityFoundation, Workspaces, Invitations, Audit, Notifications, Usage, OutboxAndAiTasks)

---

## Tests — All passing

| Suite | Count |
|-------|-------|
| Unit | 212/212 (34 suites) |
| E2E HTTP | 3/3 |
| Contracts (TS) | 2/2 |
| Contracts (Python) | 2/2 |

---

## Docker — All services healthy

| Service | Status |
|---------|--------|
| postgres | ✅ healthy |
| nats | ✅ healthy |
| redis | ✅ healthy |
| minio | ✅ healthy |
| backend-migrate | ✅ completed |
| backend | ✅ healthy |

**Profiles:** `core`, `ai`, `legacy`, `full`

### pnpm pinned to 9.15.9

`packageManager` and `engines` in `package.json`. Dockerfiles use `npm install --global pnpm@9.15.9` instead of Corepack (which selects pnpm 11+ and breaks v9 lockfiles).

---

## Missing / risks

| Issue | Impact |
|-------|--------|
| No FastAPI workers deployed | AI execution, RAG, media processing, exports not running |
| No Ollama in Docker | Local LLM unavailable |
| No Dev 2 branch found | No Dev 2 AI/RAG integration contracts present |
| MinIO bucket config | Needs `MINIO_BUCKET_NAME` environment variable |
| Multi-instance Socket.IO | Redis adapter configured but untested with 2+ instances |
