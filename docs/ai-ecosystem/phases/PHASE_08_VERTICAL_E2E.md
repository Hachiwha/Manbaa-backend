# Phase 08 — Full Vertical E2E

## Status
Infrastructure-dependent (Docker with PostgreSQL, NATS, Redis, MinIO required)

## Deterministic Component Path
Proven via unit tests:
1. User/org/workspace creation — existing infrastructure
2. Brand guide upload and indexing — Phase 02B/03 complete
3. Canvas create/edit — Phase 03 complete
4. Snapshot freeze and publication — Phase 04 complete (336 backend tests)
5. AI Orchestrator SketchContext ingestion — Phase 04 complete (191 AI tests)
6. Fake Prompt Enhancer — Phase 05 implemented
7. Fake ComponentGenerator — Phase 06A implemented
8. Suggestion persistence — Phase 07 implemented

## Deterministic Image Path
1. Same source path as component
2. Fake ImageProvider — Phase 06B implemented
3. Validation pipeline — Phase 06B implemented

## Negative E2E Cases Covered
- checksum mismatch — `canvas_ai_preview_requested.py:196`
- unknown element ID — `normalizer.py:60`
- locked/editable conflict — `canvas-ai-preview.service.ts:517`
- locked element in modified — `grounding_validator.py:100`
- duplicate NATS delivery — `idempotency.py` Redis claim

## Live Smoke Tests
- **LIVE OPENCODE: BLOCKED_EXTERNAL_DEPENDENCY** — Requires running OpenCode server at http://127.0.0.1:4096
- **LIVE QWEN: BLOCKED_EXTERNAL_DEPENDENCY** — Requires configured Qwen API endpoint

## Push Status
Not pushed
