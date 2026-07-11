# Phase 01 Backend Source Audit

## Repository state

- Branch: `feature/ai-ecosystem-phased-implementation`
- Initial HEAD: `d85df17c7b9af7e386eceb787a13fcce815fd9b1`
- Existing uncommitted Phase 01 work was preserved.
- `src/main.ts` contains a separate one-line whitespace edit made outside this phase; it will not be staged or committed with Phase 01.

## Existing implementation inspected

- Source and SourceVersion entities, DTO, controller, service, module, validation utilities, and tests.
- TypeORM migration `1700000019000-AddWorkspaceSources.ts`.
- WorkspaceStorageService source bucket/path/upload additions.
- WorkspacePermissionService editor-or-higher authorization addition.
- Source-specific snake_case event contract and cross-language fixture.
- OutboxService event-ID field compatibility.
- Application module wiring and Swagger controller metadata.

## Endpoint and authorization

- Route: `POST /api/v1/workspaces/:workspaceId/sources`.
- Authentication: global JWT guard.
- Allowed workspace roles: Owner, Admin, Editor.
- Denied roles: Commenter, Viewer, inactive/non-member users, and members whose organization does not match the authenticated organization.
- Upload: multipart field `file`; optional `projectId` must belong to the authenticated organization.

## Storage

- Bucket: `workspace-sources` via `WorkspaceStorageService` configuration.
- Required logical key:
  `organizations/<organizationId>/workspaces/<workspaceId>/sources/<sourceId>/versions/<sourceVersionId>/<sanitizedFilename>`.
- Content is validated by extension and detected signature for TXT, Markdown, PDF, and DOCX.
- The upload calculates SHA-256 and stores it as MinIO metadata and SourceVersion state.
- Paths must reject traversal, encoded traversal, backslashes, absolute paths, null/control characters, empty segments, invalid filenames, and tenant-prefix escape.

## Transaction and event

- MinIO upload occurs before the database transaction because object storage cannot participate in PostgreSQL transactions.
- Source, SourceVersion, current-version linkage, and one outbox record are finalized in one database transaction.
- A transaction failure triggers best-effort deletion of the uploaded object.
- Subject/event type: `workspace.source.process.requested`.
- Transport shape: exact snake_case source command with one UUID shared by `event_id`, outbox primary key, and NATS message ID.
- Existing OutboxService callers retain camelCase `eventId` injection by default.

## Legacy boundary

- `/documents/upload`, `document.preprocess`, `document.preprocess.result`, and `document.ready` remain unchanged.
- Canonical source uploads do not publish the legacy command.
- Legacy document uploads do not create canonical Source/SourceVersion rows or events.

## Defects found in the initial uncommitted work

1. Source lacked required name, kind, status, currentVersionId, and deletedAt fields.
2. SourceVersion lacked checksum, creator, lifecycle timestamps/error fields, tenant scope, and the required `versionNumber`/`processingStatus` naming.
3. Initial status was `QUEUED` rather than canonical `PENDING`.
4. The key omitted the required `organizations`, `workspaces`, and `versions` path segments.
5. Empty files were accepted.
6. Upload response omitted checksum and createdAt and returned 202 rather than required 201.
7. Canonical event omitted `checksum_sha256`.
8. No lifecycle consumers or transition/tenant/duplicate tests existed.
9. Migration lacked the expanded schema, positive version constraint, tenant indexes, current-version foreign key, and lifecycle failure fields.
10. Several modified files were reformatted wholesale, obscuring the functional diff.
11. A claimed outbox row could remain in `publishing` forever after process termination.
12. Lifecycle callback JWT replay state was consumed before database persistence, so a transient database failure made a legitimate redelivery fail authentication.
13. Independent lifecycle consumers could observe cross-subject events out of order and permanently acknowledge a premature transition.
14. Source authorization checked workspace membership but not active organization membership explicitly.
15. Database foreign keys did not prove organization/workspace/project, current-version, and lifecycle source-version tenant consistency.

## Completion plan

- Expand entities and migration without changing any committed migration.
- Finalize the upload response, storage path, checksum event contract, and tests.
- Add authenticated lifecycle consumers with strict tenant matching and monotonic state transitions.
- Persist before emitting workspace/user Socket.IO notifications.
- Add API, contract, migration, rollback, authorization, lifecycle, duplicate, and legacy-isolation tests.
- Run the complete backend quality, test, migration, Swagger, and Compose gates before committing.

## Implemented audit resolutions

- Active organization and workspace membership are both required; the Owner/Admin/Editor role matrix is enforced and Commenter/Viewer are denied.
- Source, SourceVersion, current-version, and lifecycle receipt relationships use tenant-scoped composite foreign keys.
- Callback JWTs are signature/scoped-claim verified without consuming Redis replay state before persistence; callback token JTIs are unique in the transactional receipt table.
- Premature forward lifecycle events are retried without a receipt, while duplicates and regressions are harmless and receipt-backed.
- Lifecycle payload fields are allow-listed and the internal token is never forwarded to Socket.IO.
- Outbox publishing uses an expiring lease, allowing interrupted `publishing` rows to be reclaimed with the same outbox/NATS message ID.
- The authoritative strict Python source command, TypeScript builder/validator, and shared fixture match exactly.
