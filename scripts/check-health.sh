#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000/api}"

curl -fsS "$BASE_URL/health/live" >/dev/null
curl -fsS "$BASE_URL/health/ping" >/dev/null
READY_JSON="$(curl -fsS "$BASE_URL/health/ready")"
HEALTH_JSON="$(curl -fsS "$BASE_URL/health")"

READY_JSON="$READY_JSON" HEALTH_JSON="$HEALTH_JSON" node <<'NODE'
const ready = JSON.parse(process.env.READY_JSON);
const health = JSON.parse(process.env.HEALTH_JSON);

if (ready.status !== 'ok') {
  throw new Error(`ready status is ${ready.status}`);
}

for (const service of ['postgres', 'nats', 'redis', 'minio']) {
  const status = ready.dependencies?.[service]?.status;
  if (status !== 'up' && status !== 'ok') {
    throw new Error(`${service} readiness status is ${status}`);
  }
}

if (health.status !== 'ok' && health.status !== 'degraded') {
  throw new Error(`aggregate health status is ${health.status}`);
}

console.log('Health validation passed.');
NODE
