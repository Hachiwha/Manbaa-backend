$ErrorActionPreference = "Stop"

docker info | Out-Null

if (!(Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.docker.example" -Destination ".env"
  throw "Created .env from .env.docker.example. Replace placeholder secrets before continuing."
}

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-env.ps1 .env
docker compose --env-file .env config --quiet
docker compose --env-file .env --profile core up -d
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-health.ps1

Write-Output "Core stack is ready."
