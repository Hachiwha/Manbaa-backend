#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required." >&2
  exit 1
fi

docker info >/dev/null

if [ ! -f .env ]; then
  cp .env.docker.example .env
  echo "Created .env from .env.docker.example. Replace placeholder secrets before continuing." >&2
  exit 1
fi

scripts/validate-env.sh .env
docker compose --env-file .env config --quiet
docker compose --env-file .env --profile core up -d
scripts/check-health.sh

echo "Core stack is ready."
