# Phase 01 Backend Canonical Source Test Report

## Status

- Phase status: `PASSED`
- Branch: `feature/ai-ecosystem-phased-implementation`
- Starting HEAD: `d85df17c7b9af7e386eceb787a13fcce815fd9b1`
- Final HEAD: the Phase 01 commit created after this report and recorded in the final handoff
- Commit: `feat(sources): add canonical workspace source processing` (SHA recorded in the final handoff; a commit cannot embed its own hash)
- Push status: not pushed, as required
- Phase 02 started: no

## Implemented scope

- Added canonical Source, SourceVersion, and lifecycle-event receipt persistence.
- Added `POST /api/v1/workspaces/:workspaceId/sources` with multipart validation and a typed 201 response.
- Enforced active organization membership plus Owner/Admin/Editor workspace authorization.
- Added exact `workspace-sources` object paths, filename/path hardening, content validation, SHA-256 calculation, upload cleanup, and tenant checks.
- Added the exact snake_case `workspace.source.process.requested` TypeScript/Python contract and fixture.
- Reused one UUID for canonical `event_id`, the outbox primary key, and the JetStream message ID while preserving camelCase `eventId` compatibility for existing callers.
- Added monotonic, tenant-scoped processing/extracted/indexed/failed consumers, transactional event receipts, token-JTI replay protection, retryable premature transitions, and post-persistence Socket.IO notifications.
- Added reclaimable outbox publishing leases so interrupted `publishing` rows are retry-safe.
- Preserved the separate legacy `document.preprocess`, `document.preprocess.result`, and `document.ready` path.

## Files changed

- Source domain: `src/modules/sources/**`
- Migration: `src/database/migrations/1700000019000-AddWorkspaceSources.ts`
- Canonical event: `src/core/messaging/events/source-process-requested.event.ts`
- Python contract and fixture: `contracts/python/source_process_requested.py`, `contracts/fixtures/source-process-requested.json`
- Storage: `src/infra/storage/workspace-storage.service.ts`
- Authorization: `src/modules/workspaces/workspace-permission.service.ts`
- Outbox ID/lease handling: `src/modules/outbox/outbox.service.ts`, `src/modules/outbox/outbox-publisher.service.ts`
- Retry-safe internal token verification: `src/core/internal-auth/internal-service-token.service.ts`
- Module wiring, tests, package scripts, audit, and this report
- Excluded from the commit: the unrelated one-line user whitespace change in `src/main.ts`

## API and security results

- Multipart Editor upload: 201 with source/version IDs, version 1, pending status, filename, MIME, size, checksum, and creation timestamp.
- No authentication: 401.
- Commenter and Viewer: 403.
- Owner, Admin, and Editor: allowed by the permission matrix.
- Inactive organization member: denied even with an Editor workspace row.
- Swagger operation: exactly one prefixed source-upload route with a 201 response.
- Empty, oversized, metadata-size-mismatched, unsupported-extension/MIME/signature, and unsafe filename inputs: rejected.
- Absolute, traversal, encoded traversal, control/null, cross-workspace, and over-encoded storage paths: rejected.
- Lifecycle callbacks require document-worker identity, exact tenant/correlation/action claims, allow-listed payload fields, and a unique callback token JTI.
- Unknown callback fields and internal tokens are not forwarded to realtime clients.

## Contract results

- TypeScript canonical contract tests: 10 passed (included in the full Jest count).
- Python Pydantic contract tests: 30 passed.
- Exact fixture round-trip, snake_case-only envelope/payload, required nullable fields, strict integers, supported MIME values, fixed bucket, canonical path, and lowercase SHA-256 all passed.
- Existing camelCase DomainEvent remains unchanged; `OutboxService` compatibility is isolated to the configured event-ID field.

## Database and migration results

- PostgreSQL: isolated `pgvector/pgvector:pg16` container and unique Compose volume.
- Empty database upgrade: all 22 migrations applied; latest/sole current migration head was `AddWorkspaceSources1700000019000`.
- Source schema: 20 table constraints; source had 4 indexes, source_version 6, and source_lifecycle_event 3.
- Verified constraints: positive version, non-negative size, lowercase SHA-256, unique source/version and storage, tenant workspace/project, tenant source-version, current version ownership, lifecycle source-version scope, lifecycle event type, and callback token-JTI uniqueness.
- Verified safe deletes: project deletion clears only `project_id`; current SourceVersion deletion clears only `current_version_id`.
- Downgrade: source tables, source enum types, and temporary workspace/project composite unique constraints removed; migration head returned to 1800.
- Re-upgrade: migration 1900 reapplied and all three source tables returned.
- `pnpm migration:validate`: 22 uniquely ordered migrations.

## Commands and quality gates

- `corepack pnpm install --frozen-lockfile`: passed; lockfile unchanged.
- `npm run lint`: passed.
- `npm run format:check`: passed for every Phase 01-owned TypeScript/JSON file.
- `corepack pnpm typecheck`: passed.
- `npm run build`: passed.
- `npm run test -- --runInBand`: passed.
- `npm run test:e2e -- --runInBand`: passed.
- `npm run test:contracts`: passed.
- `python -m ruff check contracts tests/contracts`: passed.
- `python -m ruff format --check contracts tests/contracts`: passed.
- `python -m mypy contracts/python tests/contracts`: passed.
- `corepack pnpm migration:validate`: passed.
- `docker compose config --quiet`: passed without rendering secrets.
- Docker Node 20 builder build: passed.
- Isolated PostgreSQL upgrade/constraint/downgrade/re-upgrade script: passed.

## Test totals

- Backend Jest unit/integration suites: 42 suites, 273 tests passed.
- Backend HTTP E2E suites: 2 suites, 8 tests passed.
- Python contract tests: 30 passed.
- Total unique automated tests: 311 passed.

## Provider results

- Fake-provider result: not applicable to backend Phase 01.
- Live OpenCode result: not run; prompt enhancement begins only after later phase gates.
- Live Qwen result: not run; media generation begins only after later phase gates.

## Warnings and limitations

- The host runs Node 24.15.0 while package engines require Node >=20 <23; the pinned Node 20 Docker builder passed.
- This is a pnpm repository with `pnpm-lock.yaml` and no `package-lock.json`; the reproducible equivalent of `npm ci` is `corepack pnpm install --frozen-lockfile`.
- The committed repository has pre-existing formatting debt in 314 unrelated TypeScript files. The new `format:check` gate intentionally checks all Phase 01-owned files to avoid a repository-wide unrelated rewrite.
- MinIO cannot share the PostgreSQL transaction. Database rollback triggers best-effort object deletion, but a process crash between upload and transaction can still leave an orphan for later reconciliation.
- Socket.IO notifications occur only after persistence, but they are not backed by a separate notification outbox in this phase.
- Cross-repository delivery to the Document Worker is intentionally deferred to Phase 02 and was not claimed here.
- No real secret, authorization header, signed URL, or environment value is included in this report.
