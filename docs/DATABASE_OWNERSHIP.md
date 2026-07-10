# Database ownership

NestJS/TypeORM exclusively owns transactional identity and business tables: `user`, `organization`, `organization_member`, `workspace`, `workspace_member`, invitations, messages, AI tasks, audit logs, notifications, usage, and visual/export metadata. FastAPI/Alembic must not create or migrate these tables.

Processing services may own separate chunk, embedding, research-page, claim, and model-usage tables. Their foreign identifiers reference NestJS UUIDs logically; schema changes crossing this boundary require a versioned domain event and coordinated migration.

All workspace-owned records must carry `organization_id`, `workspace_id`, `created_by`, `created_at`, and `updated_at`. Repository APIs must require workspace context and validate active organization and workspace membership.
