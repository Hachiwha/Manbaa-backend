# Backend Branch Inventory

Generated: 2026-07-10

## Baseline candidates

| Priority | Branch | SHA | Contains Dev 1 | Contains pnpm/Docker fix | Status |
|----------|--------|-----|----------------|--------------------------|--------|
| 1 | `team-baseline-v2` | — | N/A | N/A | **Does not exist** |
| 2 | `develop` | — | N/A | N/A | **Does not exist** |
| 3 | `feature/dev1-platform-final` | 139f213 | ✅ Full | ❌ No | Best validated platform branch |
| 4 | `feature/dev3-integrated-final` | e4e964d | ✅ Full | ✅ Yes | Supersedes dev1 with dev3 |

**Chosen baseline:** `feature/dev1-platform-final` (139f213) — the canonical Dev 1 platform foundation.

---

## Branch classification

| Branch | Type | SHA | Date | Dev 1 | Dev 3 | Unique | Mergeable |
|--------|------|-----|------|-------|-------|--------|-----------|
| `main` | baseline | d044dd1 | Jul 9 | ❌ | ❌ | Team baseline v1 | No — ancestor only |
| `feature/dev1-platform-final` | **active-feature** | 139f213 | Jul 10 | ✅ Full | ❌ | 1 commit, 131 files | ✅ Yes |
| `feature/dev3-integrated-final` | **integration** | e4e964d | Jul 10 | ✅ Merged | ✅ Merged | 6 commits (2 merges, 3 feature, 1 fix) | ✅ Yes |
| `origin/feat/canvas-batch-1` | **active-feature** | 15ecf14 | Jul 10 | ❌ | ✅ Batch 1 | 1 commit, 17 files | ✅ Yes |
| `origin/feat/canvas-batch-2` | **active-feature** | 7e04473 | Jul 10 | ❌ | ✅ Batch 2 | 2 commits (incl batch-1), 24 files | ✅ Yes |
| `backup/dev1-before-finalization` | backup | d044dd1 | Jul 9 | ❌ | ❌ | Same as main | No |
| `backup/dev1-platform-before-implementation-20260709` | backup | d044dd1 | Jul 9 | ❌ | ❌ | Same as main | No |
| `backup/pre-full-docker-validation` | backup | 139f213 | Jul 10 | ✅ | ❌ | Same as dev1 | No |
| `backup/dev3-batch1-before-integration` | backup | 15ecf14 | Jul 10 | ❌ | ✅ Batch 1 | Same as batch-1 | No |
| `backup/dev3-batch2-before-integration` | backup | 7e04473 | Jul 10 | ❌ | ✅ Batch 2 | Same as batch-2 | No |
| `backup/backend-before-final-integration-20260710-022754` | backup | e4e964d | Jul 10 | ✅ | ✅ | Current state | No |
| `backup/pre-full-docker-validation` | backup | 139f213 | Jul 10 | ✅ | ❌ | Same as dev1 | No |

---

## Unique commits per branch (vs main)

### feature/dev1-platform-final
```
139f213 feat(platform): complete workspace and worker integration foundation
```
- **131 files changed** — auth, orgs, workspaces, invitations, members, audit, notifications, usage, outbox, AI tasks, NATS, Redis, MinIO, health, CI, Docker, docs, contracts, migrations (7 Dev 1 migrations)
- **Migrations:** 1700000011000–1700000017000 (PlatformIdentityFoundation, Workspaces, Invitations, Audit, Notifications, Usage, OutboxAndAiTasks)
- **Modules:** auth, organizations, workspaces, sessions, notifications, audit, usage, jobs, outbox, health, realtime, redis, nats, minio

### feat/canvas-batch-1
```
15ecf14 feat(canvas): implement batch 1 canvas persistence and APIs
```
- **17 files changed** — canvas module, migration, entities, DTOs, service, controller
- **Migrations:** 1700000011000-AddCanvasTables.ts (timestamp conflicts with Dev 1's 1700000011000!)

### feat/canvas-batch-2
```
7e04473 feat(canvas): implement batch 2 realtime collaboration
```
- **24 files changed** — adds realtime collaboration on top of batch-1
- Depends on canvas-batch-1

### feature/dev3-integrated-final
```
e4e964d fix(docker): pin pnpm 9 for backend runtime          (HEAD)
5f102e1 merge(dev3): integrate batch 2
e365e16 merge(dev3): integrate batch 1
7e04473 feat(canvas): implement batch 2 realtime collaboration
139f213 feat(platform): complete workspace and worker integration foundation
15ecf14 feat(canvas): implement batch 1 canvas persistence and APIs
```
- Includes all Dev 1 + Dev 3 Batch 1 + Dev 3 Batch 2
- Additional files beyond dev1: concepts module, assets module, docker/pnpm fix, docker-compose profiles, migration renumber, expanded NATS subjects
- **Migration fix:** 1700000010500-AddCanvasTables.ts (renumbered to avoid conflict)

---

## Merge order

1. `feature/dev1-platform-final` — baseline
2. `origin/feat/canvas-batch-1` — Dev 3 canvas persistence (with migration renumber)
3. `origin/feat/canvas-batch-2` — Dev 3 realtime collaboration
4. `feature/dev3-integrated-final` (the finalization commit e4e964d) — Docker fix, concepts, assets, docker-compose restructure, expanded contracts

---

## Branches excluded

| Branch | Reason |
|--------|--------|
| All `backup/*` branches | Safety copies, no unique work |
| All `origin/*` remote-tracking backups | Represented by local branches or already merged |
