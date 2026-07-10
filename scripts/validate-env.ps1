param(
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Missing $EnvFile. Copy .env.docker.example to .env and replace secrets."
}

$content = Get-Content -Raw -LiteralPath $EnvFile
$required = @(
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "NATS_URL",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "INTERNAL_AUTH_SECRET",
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "DEV_BYPASS_AUTH"
)

foreach ($name in $required) {
  if ($content -notmatch "(?m)^$name=.+$") {
    throw "Missing required variable: $name"
  }
}

if ($content -match "(?m)^DEV_BYPASS_AUTH=true$") {
  throw "DEV_BYPASS_AUTH=true is not allowed for validation."
}

$nonCommentContent = ($content -split "`r?`n" | Where-Object { $_ -notmatch "^\s*#" }) -join "`n"
if ($nonCommentContent -match "change-me|replace-me") {
  throw "$EnvFile still contains placeholder secrets."
}

git check-ignore $EnvFile | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "$EnvFile is not ignored by Git."
}

Write-Output "Environment validation passed."
