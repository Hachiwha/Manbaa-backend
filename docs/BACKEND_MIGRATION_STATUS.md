# Backend Migration Status

Validation date: 2026-07-10  
Branch: `integration/backend-final`

## Local Validation

Command:

```bash
pnpm migration:validate
```

Result:

```text
Validated 21 uniquely ordered migrations
```

## Migration Files

1. `1700000000000-InitDatabaseSchema.ts`
2. `1700000001000-SeedAgentDefinitions.ts`
3. `1700000002000-AddDocumentStorageFields.ts`
4. `1700000002500-AddOrganizationInviteFields.ts`
5. `1700000003000-AddSessionArchiveFields.ts`
6. `1700000004000-AddDeadLetterTable.ts`
7. `1700000005000-AddMessageSearchIndexes.ts`
8. `1700000006000-AddCommentAssignedToAndResolutionNote.ts`
9. `1700000007000-AddRuleVersionStateFields.ts`
10. `1700000008000-HardenAuditLogAccess.ts`
11. `1700000009000-AddProjectsTable.ts`
12. `1700000010000-AddProjectIdToWorkflow.ts`
13. `1700000010500-AddCanvasTables.ts`
14. `1700000011000-AddPlatformIdentityFoundation.ts`
15. `1700000012000-AddWorkspaces.ts`
16. `1700000013000-AddWorkspaceInvitations.ts`
17. `1700000014000-AddPlatformAudit.ts`
18. `1700000015000-AddNotifications.ts`
19. `1700000016000-AddUsage.ts`
20. `1700000017000-AddOutboxAndAiTasks.ts`
21. `1700000018000-AddConceptsAndAssets.ts`

## Docker Database Validation

Executed against the running `postgres` service:

```sql
SELECT count(*) FROM migrations;
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
SELECT extname FROM pg_extension ORDER BY extname;
```

Results:

- Migration rows: 21
- Public tables: 49
- Extensions: `citext`, `pgcrypto`, `plpgsql`, `uuid-ossp`, `vector`

## Notes

- `synchronize` is disabled in TypeORM runtime and migration data source.
- Concepts and assets now have explicit schema support.
- The `plpgsql` extension is present by default in PostgreSQL.
