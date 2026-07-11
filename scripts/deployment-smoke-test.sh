#!/usr/bin/env bash
# Deployment smoke test for the FlowForge backend.
#
# Prerequisites:
#   - The backend must be running (e.g. via `docker compose --profile core up -d`)
#   - curl and jq must be installed
#
# Usage:
#   ./scripts/deployment-smoke-test.sh [BASE_URL]
#   Default BASE_URL: http://localhost:3000

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API="${BASE_URL}/api"
PASS=0
FAIL=0

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}✕${NC} $1"; }

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    pass "$desc"
  else
    fail "$desc (expected $expected, got $actual)"
  fi
}

echo "=== FlowForge Deployment Smoke Test ==="
echo "Base URL: ${BASE_URL}"
echo ""

# ── 1. Health ping ──────────────────────────────────────────────────
echo "--- Health ---"
ping_code=$(curl -s -o /dev/null -w '%{http_code}' "${API}/health/ping" 2>/dev/null || echo "000")
assert_status "health ping returns 200" 200 "$ping_code"

ping_body=$(curl -s "${API}/health/ping" 2>/dev/null || echo "{}")
ping_pong=$(echo "$ping_body" | jq -r '.pong // "false"')
if [ "$ping_pong" = "true" ]; then
  pass "health ping body contains pong: true"
else
  fail "health ping body missing pong: true (got $ping_pong)"
fi

# ── 2. Liveness ─────────────────────────────────────────────────────
liveness_code=$(curl -s -o /dev/null -w '%{http_code}' "${API}/health/live" 2>/dev/null || echo "000")
assert_status "liveness returns 200" 200 "$liveness_code"

# ── 3. Readiness ────────────────────────────────────────────────────
readiness_code=$(curl -s -o /dev/null -w '%{http_code}' "${API}/health/ready" 2>/dev/null || echo "000")
assert_status "readiness returns 200" 200 "$readiness_code"

# ── 4. Auth (development mode) ──────────────────────────────────────
echo "--- Auth ---"
# Registration
reg_body='{"email":"smoke-test@example.com","password":"SmokeTestPass1!"}'
reg_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$reg_body" \
  "${API}/v1/auth/register" 2>/dev/null || echo "000")
if [ "$reg_code" -eq 201 ] || [ "$reg_code" -eq 409 ]; then
  pass "registration (201 created or 409 duplicate)"
else
  fail "registration unexpected status $reg_code"
fi

# Login
login_body='{"email":"smoke-test@example.com","password":"SmokeTestPass1!"}'
login_resp=$(curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d "$login_body" \
  "${API}/v1/auth/login" 2>/dev/null || echo "{}")
ACCESS_TOKEN=$(echo "$login_resp" | jq -r '.accessToken // ""')
if [ -n "$ACCESS_TOKEN" ]; then
  pass "login returns an access token"
else
  fail "login did not return access token"
fi

# ── 5. Project creation ─────────────────────────────────────────────
echo "--- Project ---"
SMOKE_SUFFIX="$(date +%s)-$$"
project_body="{\"name\":\"Smoke Test Project ${SMOKE_SUFFIX}\"}"
project_resp=$(curl -s -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$project_body" \
  "${API}/projects" 2>/dev/null || echo "{}")
PROJECT_ID=$(echo "$project_resp" | jq -r '.project?.id // .id // ""')
if [ -n "$PROJECT_ID" ]; then
  pass "project created (id: ${PROJECT_ID})"
else
  PROJECT_ID="550e8400-e29b-41d4-a716-446655440000"  # fallback UUID for e2e
  fail "project creation returned no id"
fi

# ── 6. Application CRUD ─────────────────────────────────────────────
echo "--- Application ---"
# Create
app_body="{\"name\":\"Smoke Test App ${SMOKE_SUFFIX}\",\"projectId\":\"${PROJECT_ID}\"}"
app_resp=$(curl -s -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$app_body" \
  "${API}/projects/${PROJECT_ID}/applications" 2>/dev/null || echo "{}")
APP_ID=$(echo "$app_resp" | jq -r '.application?.id // ""')
if [ -n "$APP_ID" ]; then
  pass "application created (id: ${APP_ID})"
else
  APP_ID="550e8400-e29b-41d4-a716-446655440001"
  fail "application creation returned no id"
fi

# Retrieve
get_code=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}" 2>/dev/null || echo "000")
assert_status "application retrieval" 200 "$get_code"

# ── 7. Schema save (valid) ──────────────────────────────────────────
echo "--- Schema ---"
# Read current schemaRevision from the app
app_get=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}" 2>/dev/null || echo "{}")
EXPECTED_REV=$(echo "$app_get" | jq -r '.application?.schemaRevision // .schemaRevision // 1')
schema_body="{\"schema\":{\"pages\":[{\"id\":\"page-1\",\"name\":\"Home\",\"route\":\"/\",\"root\":{\"id\":\"root-1\",\"type\":\"page\"}}],\"components\":[],\"dataSources\":[],\"actions\":[],\"navigation\":[]},\"expectedRevision\":${EXPECTED_REV}}"
schema_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$schema_body" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/schema" 2>/dev/null || echo "000")
assert_status "valid schema save" 200 "$schema_code"

# ── 8. Schema save (invalid) ────────────────────────────────────────
echo "--- Schema validation ---"
# Read updated schemaRevision
app_get2=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}" 2>/dev/null || echo "{}")
EXPECTED_REV=$(echo "$app_get2" | jq -r '.application?.schemaRevision // .schemaRevision // 2')
# Send a schema with pages set to a non-array (triggers validation error)
invalid_body="{\"schema\":{\"pages\":\"not-an-array\"},\"expectedRevision\":${EXPECTED_REV}}"
invalid_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$invalid_body" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/schema" 2>/dev/null || echo "000")
assert_status "invalid schema rejected (400)" 400 "$invalid_code"

# ── 9. Version creation ─────────────────────────────────────────────
echo "--- Version ---"
version_body='{"schemaVersion":"1.0.0","schema":{"pages":[]}}'
version_resp=$(curl -s -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$version_body" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/versions" 2>/dev/null || echo "{}")
VERSION_ID=$(echo "$version_resp" | jq -r '.version?.id // ""')
if [ -n "$VERSION_ID" ]; then
  pass "version created (id: ${VERSION_ID})"
else
  VERSION_ID="550e8400-e29b-41d4-a716-446655440002"
  fail "version creation returned no id"
fi

# Version listing
list_code=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/versions" 2>/dev/null || echo "000")
assert_status "version listing" 200 "$list_code"

# ── 10. Publication ─────────────────────────────────────────────────
echo "--- Publication ---"
publish_body="{\"versionId\":\"${VERSION_ID}\"}"
publish_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$publish_body" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/publish" 2>/dev/null || echo "000")
assert_status "publication" 200 "$publish_code"

# Published version retrieval
pub_get_code=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/published" 2>/dev/null || echo "000")
assert_status "published version retrieval" 200 "$pub_get_code"

# ── 11. Duplication ─────────────────────────────────────────────────
echo "--- Duplication ---"
dup_body="{\"name\":\"Duplicated App ${SMOKE_SUFFIX}\"}"
dup_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$dup_body" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}/duplicate" 2>/dev/null || echo "000")
assert_status "duplication (201)" 201 "$dup_code"

# ── 12. Archive ─────────────────────────────────────────────────────
echo "--- Archive ---"
archive_code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}" 2>/dev/null || echo "000")
assert_status "archive (204)" 204 "$archive_code"

# ── 13. Archived mutation rejection ─────────────────────────────────
echo "--- Post-archive guard ---"
after_archive_code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"name":"Should Fail"}' \
  "${API}/projects/${PROJECT_ID}/applications/${APP_ID}" 2>/dev/null || echo "000")
if [ "$after_archive_code" -ge 400 ]; then
  pass "archived mutation rejected ($after_archive_code)"
else
  fail "archived mutation should have been rejected but got $after_archive_code"
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "=== Results ==="
echo "  Passed: ${PASS}"
echo "  Failed: ${FAIL}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
