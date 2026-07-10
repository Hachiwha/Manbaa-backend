#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.docker.example to .env and replace secrets." >&2
  exit 1
fi

required_vars="
NODE_ENV
PORT
DATABASE_URL
NATS_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
INTERNAL_AUTH_SECRET
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
DEV_BYPASS_AUTH
"

for name in $required_vars; do
  if ! grep -Eq "^${name}=.+" "$ENV_FILE"; then
    echo "Missing required variable: $name" >&2
    exit 1
  fi
done

if grep -Eq '^DEV_BYPASS_AUTH=true$' "$ENV_FILE"; then
  echo "DEV_BYPASS_AUTH=true is not allowed for validation." >&2
  exit 1
fi

if grep -Ev '^[[:space:]]*#' "$ENV_FILE" | grep -Eq 'change-me|replace-me'; then
  echo "$ENV_FILE still contains placeholder secrets." >&2
  exit 1
fi

if git check-ignore "$ENV_FILE" >/dev/null 2>&1; then
  echo "$ENV_FILE is ignored by Git."
else
  echo "$ENV_FILE is not ignored by Git." >&2
  exit 1
fi

echo "Environment validation passed."
