# Phase 08 — Integration Audit (Backend)

## HEAD
`49843ce9c860c7de9088eb71495f8b0adcc872c2` (+ uncommitted changes)

## Commit History
```
49843ce docs: add Phase 04-07 documentation
ec1c204 feat(canvas): add immutable AI preview snapshots and suggestions
50912b1 tetss
...
```

## Working Tree
```
 M README.md
 M src/app.module.ts
 M src/main.ts
?? src/database/migrations/1700000022000-AddApplications.ts
?? src/database/migrations/1700000024000-AddApplicationConstraints.ts
?? src/modules/applications/
```
Unrelated user changes (Applications module).

## Migration State
| Migration | Status |
|-----------|--------|
| `1700000021000-AddCanvasAiPreviewPersistence` | committed |
| `1700000023000-AddCanvasAiSuggestion` | committed |
| `1700000022000-AddApplications` | untracked (user) |
| `1700000024000-AddApplicationConstraints` | untracked (user) |

## Feature Audit

### ✅ Snapshot Pipeline
- `CanvasAiPreviewService.createExplicit()` — authorized canvas AI-preview request
- `CanvasSnapshotSerializer.serialize()` — frozen canvas revision, deterministic JSON, SHA-256
- `WorkspaceStorageService.storeSnapshot()` — MinIO upload to `organizations/<orgId>/workspaces/<wsId>/canvases/<canvasId>/snapshots/<snapshotId>/snapshot-v<snapshotVersion>.json`
- `AiPreviewSnapshot` — DB row with full lineage
- `AiTask` — DB row with snapshot lineage
- `OutboxService.create()` — transactional outbox row → NATS
- Event: `workspace.canvas.ai.preview.requested`

### ✅ Authorization
- `WorkspacePermissionService.requireEditor()` — Viewer/Commenter denied
- Cross-workspace canvas denied
- Element reference validation in `assertElementReferences()`
- Locked/editable disjoint check
- Foreign source ID validation

### ✅ Failure Compensation
- `catch (error)` in `create()`: `storage.deleteObject()` on DB failure after MinIO upload
- Duplicate idempotency-key creates no duplicate snapshot/task/outbox

### ✅ Suggestion Lifecycle (NEW)
- `CanvasAiSuggestionService.createOrUpdate()` — creates READY suggestion on task completion
- `AiTaskEventsService` — wired to create suggestions on `workspace.ai.task.completed`
- `AiTaskEventsService` — emits `canvas.ai.preview.ready/stale/failed/cancelled` Socket.IO events

### ✅ Stale Protection (NEW)
- `CanvasAiSuggestionService.markStale()` — uses `snapshotId`, `snapshotVersion`, `canvasRevision` lineage, configurable per canvas
- Accept/reject blocks stale suggestions with `ConflictException`

### ✅ Socket.IO Lifecycle (NEW)
- 11 events: `queued`, `started`, `progress`, `ready`, `stale`, `failed`, `cancelled`, `superseded`, `accepted`, `rejected`
- Typed payload interfaces for all events
- Scoped to canvas room

### ✅ NATS Subjects
- `workspace.ai.task.{started,progress,completed,failed,cancelled}` — backend consumer
- `workspace.ai.task.cancel.requested` — outgoing publisher for cancellation
- `workspace.canvas.ai.preview.requested` — outgoing publisher
- `workspace.asset.generate.requested` — outgoing publisher for image generation

### PREVIEW RENDERER: PENDING
Preview bytes are not rendered server-side. The AI preview is an immutable snapshot reference; rendering is client-side.

## Limitations
- No `pnpm test:e2e` target available for Docker-based E2E
- No `docker compose config` validation in CI
- Applications module is user-added and untracked

## Push Status
Not pushed
