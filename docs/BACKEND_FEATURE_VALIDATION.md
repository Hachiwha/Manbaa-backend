# Backend Feature Validation

Validation date: 2026-07-10  
Branch: `integration/backend-final`  
Starting HEAD: `3fc40dc1315fbfab8da01f3b6c94ef02abcfa7ae`

## Status Legend

- `working`: implemented and covered by automated or live validation.
- `partial`: API or storage exists, but lifecycle is not complete.
- `worker-dependent`: requires FastAPI/Ollama/external worker execution.
- `missing`: no active implementation found.
- `blocked`: could not be validated on this machine.

## Matrix

| Domain | Status | Evidence |
| --- | --- | --- |
| Auth | working | Unit/e2e pass; live register returned JWT pair and organization. |
| Organizations | working | Unit tests cover CRUD/member/role/last-owner/cross-org paths. |
| Workspaces | working | Unit/e2e pass; live workspace create succeeded. |
| Workspace members | working | Unit tests cover permission service and member lifecycle; Socket.IO revocation method exists. |
| Invitations | working | Service supports create/list/revoke/accept, expiration and duplicate prevention. |
| Audit | working | `AuditModule` now registered; audit unit/integration tests pass; append-only trigger migration exists. |
| Notifications | working | Module registered; list/read/read-all routes active. |
| Usage/quotas | working | Module registered; AI task path uses usage reservations; tests pass. |
| AI tasks | partial | REST create/list/get/cancel and outbox path exist; terminal execution is worker-dependent. |
| NATS | working | Core stream initialized; backend NATS bridge active; no startup errors after duplicate durable fix. |
| Redis | working | `/api/health/ready` reports Redis up. |
| MinIO | working | MinIO health up; document and workspace clients include `region: 'us-east-1'`; buckets initialized. |
| Socket.IO | partial | Auth adapter and room guards tested; single-instance validation passed through startup; multi-instance remains unverified. |
| Canvas | working | Module registered; CRUD/realtime routes active; tests pass. |
| Concepts | partial | `ConceptsModule` registered; table migration added; live create/list/archive succeeded. Generate/evaluate/approve/reject routes exist; actual AI generation is worker-dependent. |
| Assets | partial | `AssetsModule` implemented and registered; table migration added; live create/update/versions/signed-download succeeded. Generation/variations are worker-dependent placeholders. |
| Exports | partial | Elsa JSON export is implemented in-process. BPMN/PDF create pipeline execution records and remain worker-dependent. Export NATS subjects exist. |
| Skills | partial | CRUD/export/text-search fallback live-tested with FastAPI disabled. Embedding generation remains worker-dependent. |
| Health | working | `/live`, `/ready`, `/ping`, and aggregate `/health` validated. Optional FastAPI/Ollama/Elsa disabled cleanly. |
| Swagger | working | `/docs-json` returns 130 paths and bearer auth scheme. |

## Live Smoke Result

The Docker backend successfully handled:

- `POST /api/v1/auth/register`
- `POST /api/v1/workspaces`
- `POST /api/v1/workspaces/:workspaceId/concepts`
- `GET /api/v1/workspaces/:workspaceId/concepts`
- `POST /api/v1/workspaces/:workspaceId/concepts/:conceptId/archive`
- `POST /api/v1/workspaces/:workspaceId/assets`
- `PATCH /api/v1/workspaces/:workspaceId/assets/:assetId`
- `GET /api/v1/workspaces/:workspaceId/assets/:assetId/versions`
- `GET /api/v1/workspaces/:workspaceId/assets/:assetId/download-url`
- `POST /api/skills`
- `GET /api/skills/export`
- `POST /api/skills/search`

## Remaining Risks

- FastAPI workers are not in this repository.
- Ollama is optional and disabled in the core profile.
- Multi-instance Socket.IO was not fully validated with two backend instances.
- Asset/concept generation requires real workers to complete generated payloads.
- BPMN/PDF export generation is worker-dependent.
- Skills semantic embeddings require FastAPI; text fallback works when `FASTAPI_ENABLED=false`.
