# Manbaa API — Bruno Collection

API client collection for the [Manbaa](https://manbaa.io) process elicitation and workflow management platform.

## Prerequisites

- [Bruno](https://www.usebruno.com/) desktop app (recommended) or CLI
- Docker stack running (`./scripts/dev-up.sh` from the project root)
- Backend migrations completed

## Quick Start

1. Open Bruno
2. Click **Open Collection** → select `ppp-backend/bruno/manbaa-api`
3. Select environment: **local** (host port 3000) or **docker** (Caddy reverse proxy port 80)
4. Navigate to **01-Auth → Login**, click **Send**
5. The `accessToken` is automatically saved for subsequent requests
6. Run through **02-Organizations**, **03-Workspaces**, etc. to populate IDs

## Collection Structure

| Folder | Description |
|---|---|
| `00-Health` | Liveness, readiness, dependency checks |
| `01-Auth` | Register, login, refresh, me, logout |
| `02-Organizations` | CRUD + membership |
| `03-Workspaces` | CRUD + archive/restore/duplicate + members |
| `04-Projects` | CRUD |
| `05-Sessions` | Session lifecycle |
| `06-Sources` | Multipart source upload + polling |
| `07-Canvas` | Get/create canvas, objects, snapshots |
| `08-AI-Tasks` | Create, list, get, cancel |
| `09-Suggestions` | List, get, accept, reject |
| `10-Assets` | List, get, versions, download URL, approve/reject |
| `11-Applications` | Application CRUD + schema + versions + publish |
| `90-Negative-Tests` | 401, 403, 400, 404, 409 scenarios |
| `99-Full-Workflow` | End-to-end runner |

## Environments

| Environment | `baseUrl` | Use case |
|---|---|---|
| `local` | `http://localhost:3000/api` | Backend running directly on host |
| `docker` | `http://localhost/api` | Stack behind Caddy reverse proxy |
| `remote.example` | `https://api.manbaa.example.com/api` | Template for production |

## Auth Flow

The backend uses **Bearer JWT** authentication:
- Login returns `accessToken` in the response body
- Post-response scripts automatically store it as `{{accessToken}}`
- All protected requests include `Authorization: Bearer {{accessToken}}`

## Source Upload Flow

1. **Upload** → POST to sources endpoint (returns `sourceId`, status `PENDING`)
2. **Poll** → GET source status repeatedly until `INDEXED`
3. The poll request in `06-Sources` includes a pre-request script with bounded retry

## AI Task Lifecycle

HTTP endpoints (documented here) handle creation and status checking:

| Status | Description |
|---|---|
| `QUEUED` | Task accepted and waiting for worker |
| `PROCESSING` | Worker is executing |
| `COMPLETED` | Successfully completed |
| `FAILED` | Error during processing |
| `CANCELLED` | User requested cancellation |
| `SUPERSEDED` | Superseded by a newer request |

**Real-time updates** are delivered via Socket.IO (not HTTP). See events below.

## Socket.IO Events

Bruno does not test WebSocket behavior. These events are documented for reference:

| Event | Direction | Payload |
|---|---|---|
| `join_room` | Client → Server | `{ room: "workspace:{id}" }` |
| `leave_room` | Client → Server | `{ room: "workspace:{id}" }` |
| `ai.task.queued` | Server → Client | `{ taskId, taskType, workspaceId }` |
| `ai.task.started` | Server → Client | `{ taskId, timestamp }` |
| `ai.task.progress` | Server → Client | `{ taskId, progress, message }` |
| `ai.task.completed` | Server → Client | `{ taskId, result }` |
| `ai.task.failed` | Server → Client | `{ taskId, error }` |
| `ai.task.cancelled` | Server → Client | `{ taskId, reason }` |
| `source.processed` | Server → Client | `{ sourceId, status }` |
| `workspace.updated` | Server → Client | `{ workspaceId, ... }` |
| `canvas.preview.ready` | Server → Client | `{ suggestionId, taskId }` |

Connect with `io("{{socketUrl}}", { auth: { token: "{{accessToken}}" } })`.

## CLI Usage

```bash
# Install Bruno CLI (one time)
npm install -g @usebruno/cli

# Run all requests against local backend
bru run bruno/manbaa-api --env local

# Run health checks only  
bru run bruno/manbaa-api/requests/00-Health --env local

# Run full workflow
bru run bruno/manbaa-api/requests/99-Full-Workflow --env local

# Run with output file
bru run bruno/manbaa-api --env local --output report.json
```

## CI Usage

```bash
# Start stack
./scripts/dev-up.sh

# Wait for health
./scripts/health-check.sh

# Run Bruno  
bru run bruno/manbaa-api/requests/00-Health --env docker
bru run bruno/manbaa-api/requests/01-Auth --env docker
bru run bruno/manbaa-api/requests/99-Full-Workflow --env docker
```

## Known Limitations

- Polling requests use simple retry logic (no exponential backoff)
- Viewer-role negative test requires a separate viewer token
- Socket.IO realtime events are not tested through Bruno
- Some endpoints require pre-existing IDs (organization, workspace, etc.)
- The full workflow depends on `DEV_BYPASS_AUTH=true` or registered credentials
