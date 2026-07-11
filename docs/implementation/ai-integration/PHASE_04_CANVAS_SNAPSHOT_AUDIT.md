# Phase 04 – Canvas Snapshot and Sketch Transport Audit (Backend)

## Branch and HEAD

| Field | Value |
|---|---|
| Branch | `feature/ai-ecosystem-phased-implementation` |
| Starting HEAD | `a0f750e7c0d9f726c83ce264beae76e6e19aa001` |

## Existing Canvas Entities

| Entity | Table | Purpose |
|---|---|---|
| `Canvas` | `canvas` | Top-level canvas, linked 1:1 to workflow |
| `CanvasObject` | `canvas_object` | Individual elements (type, position, style, properties) |
| `CanvasOperation` | `canvas_operation` | Append-only operation log with monotonically increasing sequence numbers |
| `CanvasSnapshot` | `canvas_snapshot` | Full state capture (JSONB in DB), not immutable, no tenant isolation, no MinIO storage |
| `CanvasVersion` | `canvas_version` | Links canvas state to workflow versions |

## Gap Analysis

| Requirement | Existing | Phase 04 Need |
|---|---|---|
| Immutable snapshot in MinIO | `CanvasSnapshot` stores in DB JSONB, can be updated | New `AiPreviewSnapshot` entity with MinIO storage |
| SHA-256 checksum | Not tracked | Required for integrity |
| Tenant-safe storage key | `CanvasSnapshot` has no storage keys | New MinIO key pattern |
| Debounce/coalescing | Only cursor throttle (50ms) | New `CanvasAiPreviewCoordinator` service |
| AI preview NATS subject | `workspace.canvas.analyze.requested` (different purpose) | New `workspace.canvas.ai.preview.requested` |
| Transactional outbox | Exists for `AiTask` creation | Reuse `OutboxService` |
| Supersession | Not implemented | New status/supersession logic |
| Socket.IO events for AI preview | `canvas.object.*`, `canvas.committed` | New `canvas.ai.preview.*` events |

## Existing NATS Subjects (canvas-related)

- `workspace.canvas.analyze.requested` — existing, different purpose
- `workspace.canvas.analysis.completed` — existing, different purpose

## Existing Storage Buckets

`workspace-snapshots` and `workspace-previews` buckets are already defined in `WORKSPACE_BUCKETS`.

## Existing Outbox Pattern

`OutboxService.create()` inside TypeORM transaction — used by `AiTasksService.create()`. Reusable.

## Security Model

- `WsRoomGuardService` validates org-scoped access for `canvas:` rooms
- `WorkspaceStorageService` validates workspace object paths
- Role-based access via `@Roles()` decorator (Owner/Admin/Editor)
