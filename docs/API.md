# FlowForge API Reference

## Base URL

`http://localhost:3000/api`

## Authentication

All endpoints except health and auth registration/login require a Bearer JWT token.

```
Authorization: Bearer <access_token>
```

Authentication endpoints are under `/v1/auth`:
- `POST /v1/auth/register` — Register new user + organization
- `POST /v1/auth/login` — Login with email/password
- `POST /v1/auth/refresh` — Refresh access token
- `POST /v1/auth/logout` — Revoke refresh token
- `GET /v1/auth/me` — Current user info

## Health

- `GET /health` — Aggregate health status
- `GET /health/live` — Liveness check
- `GET /health/ready` — Readiness check
- `GET /health/ping` — Simple ping

## Projects

- `POST /api/projects` — Create project
- `GET /api/projects` — List projects
- `GET /api/projects/:id` — Get project
- `DELETE /api/projects/:id` — Delete project (cascade)
- `GET /api/projects/:id/workflows` — List workflows in project

## Applications

All application endpoints are scoped under a project:

- `POST /api/projects/:projectId/applications` — Create application
- `GET /api/projects/:projectId/applications` — List applications
- `GET /api/projects/:projectId/applications/:id` — Get application
- `PATCH /api/projects/:projectId/applications/:id` — Update metadata
- `DELETE /api/projects/:projectId/applications/:id` — Archive application

### Schema

- `POST /api/projects/:projectId/applications/:id/schema` — Save draft schema
- `GET /api/projects/:projectId/applications/:id/schema` — Get draft schema

### Versions

- `POST /api/projects/:projectId/applications/:id/versions` — Create immutable version
- `GET /api/projects/:projectId/applications/:id/versions` — List versions
- `GET /api/projects/:projectId/applications/:id/versions/:versionId` — Get version

### Publish

- `POST /api/projects/:projectId/applications/:id/publish` — Publish a version
- `GET /api/projects/:projectId/applications/:id/published` — Get published version

### Duplicate

- `POST /api/projects/:projectId/applications/:id/duplicate` — Duplicate application

## Workflows

- `POST /api/workflows` — Create workflow
- `GET /api/workflows` — List workflows
- `GET /api/workflows/:id` — Get workflow
- `PATCH /api/workflows/:id` — Update workflow
- `DELETE /api/workflows/:id` — Archive workflow
- `POST /api/workflows/:id/versions` — Create version
- `GET /api/workflows/:id/versions` — List versions
- `GET /api/workflows/:id/versions/:versionNumber` — Get version
- `POST /api/workflows/:id/duplicate` — Duplicate workflow
- `GET /api/workflows/:id/diagram-data` — Get diagram data
- `POST /api/workflows/:id/export/elsa` — Export to Elsa JSON
- `POST /api/workflows/:id/export/bpmn` — Export to BPMN
- `POST /api/workflows/:id/export/pdf` — Export to PDF

## Organizations

- `POST /organizations` — Invite user
- `PATCH /organizations/users/:userId` — Update user role
- `DELETE /organizations/users/:userId` — Revoke user

## Swagger UI

Full interactive API documentation: `http://localhost:3000/docs`
