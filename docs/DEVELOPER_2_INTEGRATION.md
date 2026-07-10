# Developer 2 integration

Reuse `WorkspacePermissionService`, `AiTasksService`, `NatsPublisherService`, `PlatformAuditService`, `NotificationsService`, `UsageService`, `WorkspaceStorageService`, and `InternalServiceTokenService`. Do not add parallel authentication or workspace permissions in FastAPI. Processing-table ownership remains defined in `DATABASE_OWNERSHIP.md`.
