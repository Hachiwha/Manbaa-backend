# Release Checklist

## Pre-Release

- [ ] All quality gates pass:
  - [ ] `pnpm lint` — 0 errors
  - [ ] `pnpm typecheck` — 0 errors
  - [ ] `pnpm test -- --runInBand` — all tests pass
  - [ ] `pnpm test:e2e` — all tests pass
  - [ ] `pnpm build` — clean build
  - [ ] `pnpm migration:validate` — all migrations valid
  - [ ] `docker compose config --quiet` — valid Compose file
- [ ] No placeholder secrets in `.env.example` / `.env.docker.example`
- [ ] `DEV_BYPASS_AUTH` is `false`
- [ ] CORS origins are restricted in production
- [ ] Helmet headers are configured appropriately

## Environment

- [ ] All required env vars documented in `.env.example`
- [ ] Secrets generated (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, MINIO_ROOT_PASSWORD, APP_DB_PASSWORD)
- [ ] Database URL points to production PostgreSQL
- [ ] NATS URL uses production NATS address
- [ ] Redis URL uses production Redis address
- [ ] MinIO endpoint uses production MinIO address

## Database

- [ ] Run migrations: `pnpm migration:run`
- [ ] Verify all extensions enabled: vector, pgcrypto, citext
- [ ] Verify indexes exist
- [ ] Verify audit log immutability triggers

## Docker

- [ ] Production image builds: `docker build --target production -t flowforge-backend .`
- [ ] Docker Compose production profile starts cleanly
- [ ] Health checks respond correctly
- [ ] Non-root user in production container
- [ ] Graceful shutdown configured

## API

- [ ] Swagger UI loads at `/docs`
- [ ] Health endpoints respond:
  - [ ] `GET /api/health/ping` — 200
  - [ ] `GET /api/health/live` — 200
  - [ ] `GET /api/health/ready` — 200

## Smoke Test

- [ ] Able to create organization
- [ ] Able to create project
- [ ] Able to create application
- [ ] Able to save draft schema
- [ ] Able to create version
- [ ] Able to publish version
- [ ] Able to duplicate application
- [ ] Organization isolation enforced
- [ ] Audit events recorded

## Post-Release

- [ ] Monitor health endpoints
- [ ] Verify logs are shipping to central logging
- [ ] Verify error reporting is configured
- [ ] Run smoke test against production
