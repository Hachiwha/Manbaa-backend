# Deployment Readiness

| Area | Current Status | Evidence | Remaining Risk | Required Production Action |
|------|---------------|----------|---------------|--------------------------|
| **Auth** | ✅ Complete | JWT access+refresh tokens, bcrypt hashing, rotation, family revocation, login history, account lockout | None | Set strong JWT secrets, enable DEV_BYPASS_AUTH=false |
| **Organization isolation** | ✅ Complete | orgId on all entities, OrgScopeInterceptor, org scoped queries | None | Verify in staging |
| **Projects** | ✅ Complete | CRUD with org scope, audit, pagination | None | — |
| **Applications** | ✅ Complete | CRUD, schema drafts, versions, publishing, duplication, archive | New module - needs production testing | Monitor for edge cases |
| **Application schema validation** | ✅ Complete | schemaVersion, unique routes, unique node IDs, cycle-free trees, component type checks | Validator is conservative - may reject valid schemas | Tune validation rules based on real usage |
| **Application versions** | ✅ Complete | Immutable versions, auto-increment, publishing, published version retrieval | — | — |
| **Audit** | ✅ Complete | Immutable audit logs, application-level events | None | — |
| **Health** | ✅ Complete | Liveness/readiness separation, dependency checks, NATS ping | None | Configure health endpoints for load balancer |
| **Database migrations** | ✅ Complete | 25 migrations, uniquely ordered, reversible | None | Always run migrations before app startup |
| **Docker** | ✅ Complete | Multi-stage build, Compose with profiles, health checks | None | Use production profile, set env vars |
| **Rate limiting** | ✅ Complete | @nestjs/throttler with configurable TTL/limit | None | Tune limits for expected load |
| **CORS** | ✅ Complete | Production wildcard blocked, configurable origins | None | Set specific CORS origins |
| **Helmet** | ✅ Complete | Security headers applied | None | Review CSP for frontend |
| **NATS** | ✅ Complete | JetStream streams, durable consumers, DLQ | None | Configure NKeys for production |
| **Redis** | ✅ Complete | Connection with configurable timeout | None | Use Redis Sentinel or cluster for HA |
| **MinIO** | ✅ Complete | Bucket initialization, signed URL support | None | Use dedicated MinIO instance with SSL |
| **Swagger** | ✅ Complete | 130+ API paths documented | None | Review for completeness |
| **Tests** | ✅ Complete | 336 unit tests, 8 e2e tests, contract tests | Coverage for new module is adequate | Add integration tests for production scenarios |
| **CI** | ✅ Complete | GitHub Actions with full quality gate | None | Ensure secrets are configured in CI |
| **Error handling** | ✅ Complete | Standardized error envelope, no stack traces in production | None | — |
| **Logging** | ✅ Complete | Pino structured logging, correlation IDs | None | Configure log levels for production |
| **Secrets** | ⚠️ Needs review | .env.example has placeholder values | .env may contain real secrets | Audit .env before production deployment |
| **AI generation** | ⚠️ Partial | AI gateway exists, but no application-specific AI generation | Application AI integration not yet wired | Connect application AI generation to existing AI gateway |
| **Workflows** | ✅ Complete | CRUD, versioning, export (Elsa, BPMN, PDF) | None | — |
