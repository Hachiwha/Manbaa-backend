# Platform integration

Developers 2 and 3 should import `WorkspacePermissionService` and call `requireMember` or `requireRole`; do not reproduce role comparisons. Canonical events use `createDomainEvent()` and `NatsPublisherService.publishDomainEvent()`. The NATS subject must equal `eventType`; `eventId` is the JetStream idempotency key. JSON Schema, Pydantic model, and the shared fixture live under `contracts/`.

HTTP routes use `/api/v1`. Authenticated handlers receive `{ id, email, orgId, role }`; workspace authorization must be based on active `workspace_member` records, not the legacy global role. New workspace-owned queries must include both the entity ID and workspace ID to prevent cross-workspace IDOR.

Migrations `1700000011000` and `1700000012000` introduce multi-organization membership, refresh-token families, workspaces, and workspace memberships while retaining legacy projects for progressive migration.

Runtime interfaces include `AiTasksService`, `OutboxService`, `PlatformAuditService`, `NotificationsService`, `UsageService`, `WorkspaceStorageService`, `RedisService`, and `InternalServiceTokenService`. AI task creation writes usage, task, and outbox state atomically; terminal worker events settle usage and notify the user.
