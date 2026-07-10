#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"

compose() {
  if [ -n "$PROJECT_NAME" ]; then
    docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" "$@"
  else
    docker compose --env-file "$ENV_FILE" "$@"
  fi
}

wait_http_ok() {
  url="$1"
  attempts="${2:-60}"
  i=1
  while [ "$i" -le "$attempts" ]; do
    if curl --max-time 10 -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

json_get() {
  path="$1"
  file="$2"
  node -e "
const fs = require('fs');
const path = process.argv[1].split('.');
let value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const part of path) value = value?.[part];
if (value === undefined || value === null) process.exit(2);
process.stdout.write(String(value));
" "$path" "$file"
}

command -v docker >/dev/null 2>&1 || { echo "Docker CLI is not available." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is not available." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is not available." >&2; exit 1; }

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE." >&2; exit 1; }

sh scripts/validate-env.sh "$ENV_FILE"
compose config --quiet
compose --profile core up -d

wait_http_ok "$BASE_URL/api/health/ready"
curl --max-time 10 -fsS "$BASE_URL/api/health/live" >/dev/null
curl --max-time 10 -fsS "$BASE_URL/api/health/ping" >/dev/null
curl --max-time 10 -fsS "$BASE_URL/api/health" >/dev/null

compose exec -T postgres psql -U app -d appdb -c "SELECT 1;" >/dev/null
compose exec -T nats wget -qO- http://localhost:8222/healthz >/dev/null
compose exec -T redis redis-cli ping | grep -q PONG
compose exec -T minio curl -fsS http://localhost:9000/minio/health/live >/dev/null

stamp="$(date +%Y%m%d%H%M%S)"
email="deployment-smoke-${stamp}-$$@example.com"
password="SmokeTestPassword123!"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

register_body="$tmpdir/register-body.json"
register_response="$tmpdir/register-response.json"
workspace_body="$tmpdir/workspace-body.json"
workspace_response="$tmpdir/workspace-response.json"
task_body="$tmpdir/task-body.json"
task_response="$tmpdir/task-response.json"

printf '{"email":"%s","password":"%s"}' "$email" "$password" > "$register_body"
curl --max-time 20 -fsS -X POST "$BASE_URL/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  --data-binary "@$register_body" > "$register_response"

access_token="$(json_get accessToken "$register_response")"
organization_id="$(json_get organization.id "$register_response")"

printf '{"name":"Deployment smoke %s","description":"Automated deployment smoke test"}' "$stamp" > "$workspace_body"
curl --max-time 20 -fsS -X POST "$BASE_URL/api/v1/workspaces?organizationId=$organization_id" \
  -H "Authorization: Bearer $access_token" \
  -H 'Content-Type: application/json' \
  --data-binary "@$workspace_body" > "$workspace_response"

workspace_id="$(json_get id "$workspace_response")"

printf '{"taskType":"chat","payload":{"message":"deployment smoke test"},"idempotencyKey":"deployment-smoke-%s"}' "$stamp" > "$task_body"
curl --max-time 20 -fsS -X POST "$BASE_URL/api/v1/workspaces/$workspace_id/ai/tasks" \
  -H "Authorization: Bearer $access_token" \
  -H 'Content-Type: application/json' \
  --data-binary "@$task_body" > "$task_response"

task_id="$(json_get id "$task_response")"
curl --max-time 20 -fsS -X POST "$BASE_URL/api/v1/workspaces/$workspace_id/ai/tasks/$task_id/cancel" \
  -H "Authorization: Bearer $access_token" >/dev/null

echo "Deployment smoke test passed."
echo "Validated health, PostgreSQL, NATS, Redis, MinIO, auth registration, workspace creation, and AI task cancel."
