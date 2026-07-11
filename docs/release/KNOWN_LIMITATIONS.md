# Known Limitations

## Application Module (New)

| Limitation | Impact | Workaround | Future Fix |
|-----------|--------|-----------|------------|
| Application AI generation not wired | No AI-assisted app generation yet | Manual schema editing via REST API | Connect to existing AI gateway via NATS |
| No builder operation protocol | Schema changes are full-draft replacements | Use draft schema endpoint | Add typed operations (addComponent, updateComponent, deleteComponent) |
| Schema version migration strategy not implemented | Forward migration of schema versions must be handled by clients | Ensure clients use compatible schema versions | Add schema migration registry |

## Infrastructure

| Limitation | Impact | Workaround | Future Fix |
|-----------|--------|-----------|------------|
| No NATS authentication | Any service on the network can publish | Network isolation | Add NKeys per-subject permissions |
| Single-node NATS | No HA for message bus | Docker restart policy | Multi-node JetStream cluster |
| No pgvector HNSW index | IVFFlat may be slower for small datasets | Not needed at current scale | Add HNSW index option |
| FastAPI AI service not in repo | AI workers require separate deployment | Set FASTAPI_ENABLED=false | Include worker deployment config |
| Elsa Server uses third-party image | Version drift risk from upstream | Pin exact version | Build custom Elsa image |

## Testing

| Limitation | Impact | Workaround | Future Fix |
|-----------|--------|-----------|------------|
| No Testcontainers migration test | Migration testing requires real PostgreSQL | Run migration:run manually | Add testcontainers migration spec |
| No application-specific e2e tests | New module e2e not yet covered | Manual testing via Swagger UI | Add application e2e tests |
| No organization isolation e2e test | Cross-org security not tested in CI | Review code for org scoping | Add isolation e2e test |

## Operations

| Limitation | Impact | Workaround | Future Fix |
|-----------|--------|-----------|------------|
| No metrics endpoint | No Prometheus metrics | Use health endpoints | Add @nestjs/metrics or Prometheus client |
| No structured audit export for applications | Application events only in DB | Query audit_log table | Add CSV/JSON export endpoints |
| Node.js 24 not officially supported | Warning during install | Use Node 20-22 | Update engines range |
