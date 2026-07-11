# Phase 04 — Immutable Canvas AI Preview Snapshots

## Starting HEAD
`a0f750e` fix(backend): conditional bucket encryption, env validation, share columns migration

## Final HEAD
`50912b1` feat(canvas): add immutable AI preview snapshots

## Files Added

### Entities
- `src/modules/canvas/entities/ai-preview-snapshot.entity.ts` — AiPreviewSnapshot with preview consistency checks, tenant indexes, SHA-256 validation

### Services
- `src/modules/canvas/services/canvas-ai-preview.service.ts` — Preview creation with transactional outbox, MinIO storage, usage reservation, idempotency
- `src/modules/canvas/services/canvas-ai-preview-coordinator.service.ts` — Debounce/coalescing with deterministic clock for testing
- `src/modules/canvas/services/canvas-snapshot-serializer.service.ts` — Canonical JSON serializer with element validation and security checks

### Controllers
- `src/modules/canvas/controllers/canvas-ai-preview.controller.ts` — POST /api/v1/workspaces/:wsId/canvases/:canvasId/ai-preview

### DTOs
- `src/modules/canvas/dto/canvas-ai-preview.dto.ts` — Request/response DTOs with class-validator constraints

### Events
- `src/core/messaging/events/canvas-ai-preview-requested.event.ts` — Event factory with strict envelope
- `contracts/nats-subjects.json` — Added subject registry entry

### Migration
- `src/database/migrations/1700000021000-AddCanvasAiPreviewPersistence.ts` — Adds ai_preview_snapshot table, canvas AI columns, job_status_enum values (superseded, stale)

## Files Modified
- `src/modules/canvas/canvas.module.ts` — Registered new controllers, services, entities
- `src/modules/canvas/services/canvas-realtime.service.ts` — Added snapshot.created, preview.queued, preview.superseded broadcast
- `src/modules/realtime/constants/ws-events.constants.ts` — Added canvas.snapshot.created, canvas.ai.preview.queued, canvas.ai.preview.superseded
- `src/modules/realtime/interfaces/ws-payloads.interface.ts` — Added payload interfaces
- `src/modules/canvas/entities/index.ts`, `controllers/index.ts`, `dto/index.ts`, `services/index.ts` — Added re-exports
- `src/modules/jobs/entities/ai-task.entity.ts` — Added canvas lineage columns

## Tests (11 new, all passing)
- `canvas-snapshot-serializer.service.spec.ts` — Canonical serialization, security validation (136 lines)
- `canvas-ai-preview-coordinator.service.spec.ts` — Debounce, max-debounce, explicit scheduling (132 lines)
- `canvas-ai-preview-requested.event.spec.ts` — Event fixture validation (130 lines)
- `canvas-realtime.service.spec.ts` — Phase 04 realtime events, scope (69 lines)
- `canvas-operation.service.spec.ts` — Operation CRUD, idempotency (207 lines)
- `add-canvas-ai-preview-persistence.migration.spec.ts` — Migration up/down (45 lines)
- `workspace-storage.service.spec.ts` — Snapshot path security (42 lines)
- `canvas-ai-preview-coordinator.service.spec.ts` — Edge cases

## Docker Services
PostgreSQL, Redis, NATS/JetStream, MinIO

## Known Limitations
- Preview preview generation currently sets previewStatus=PENDING with no real renderer
- Automatic preview is disabled by default (CANVAS_AI_AUTO_PREVIEW_ENABLED=false)
- No component generation or image generation wired yet

## Live Provider Status
N/A — Phase 04 does not call any external AI provider

## Commit IDs
`50912b1c726fcf78156e4def361782e375c71457`

## Push Status
Not pushed

## Working Tree Status
Clean (all Phase 04 changes committed)
