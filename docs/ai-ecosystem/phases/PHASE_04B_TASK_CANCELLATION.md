# Phase 04B — Task Cancellation Lifecycle

## Starting HEAD
`50912b1` feat(canvas): add immutable AI preview snapshots

## Final HEAD
To be committed

## Files Modified

### Backend
- `src/core/messaging/subjects.ts` — Added `AI_TASK_CANCELLED: 'workspace.ai.task.cancelled'`
- `contracts/nats-subjects.json` — Added `workspace.ai.task.cancelled` to registry
- `src/modules/jobs/ai-task-events.service.ts` — Added `cancelled` subscription and handler

### AI Services
- `shared/src/ppp_ai_shared/contracts/subjects.py` — Added `AI_TASK_CANCELLED` constant
- `shared/src/ppp_ai_shared/contracts/nats-subjects.json` — Added subject
- `nats-subjects.json` (root) — Added cancel.requested and cancelled subjects

## Files Added

### AI Orchestrator
- `apps/ai-orchestrator/src/ai_orchestrator/handlers/task_cancellation.py` — Durable consumer for `workspace.ai.task.cancel.requested`
- `apps/ai-orchestrator/orchestrator_migrations/versions/0002_create_task_leases.py` — PostgreSQL-backed task lease table
- `apps/ai-orchestrator/src/ai_orchestrator/db/models.py` — Added `TaskLease` model with `TaskLeaseStatus` enum
- `apps/ai-orchestrator/src/ai_orchestrator/db/repository.py` — Added `TaskLeaseRepository` with claim/complete/fail/cancel/heartbeat

## Task Lease States
CLAIMED → PROCESSING → COMPLETED | FAILED | CANCELLED | SUPERSEDED

## Tests
191 AI services tests pass, 336 backend tests pass

## Push Status
Not pushed
