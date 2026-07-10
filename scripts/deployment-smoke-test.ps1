param(
  [string]$EnvFile = ".env",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ProjectName = $env:COMPOSE_PROJECT_NAME
)

$ErrorActionPreference = "Stop"

function Invoke-DockerCompose {
  param([string[]]$ComposeArgs)

  $base = @("compose")
  if ($ProjectName) {
    $base += @("--project-name", $ProjectName)
  }
  $base += @("--env-file", $EnvFile)
  & docker @base @ComposeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($ComposeArgs -join ' ') failed"
  }
}

function Wait-HttpOk {
  param([string]$Url, [int]$Attempts = 60)

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Timed out waiting for $Url"
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI is not available."
}

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Missing $EnvFile."
}

Write-Output "Validating environment and Compose config..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-env.ps1 $EnvFile
Invoke-DockerCompose @("config", "--quiet")

Write-Output "Starting core services..."
Invoke-DockerCompose @("--profile", "core", "up", "-d")

Write-Output "Checking health endpoints..."
Wait-HttpOk "$BaseUrl/api/health/ready"
Invoke-WebRequest -Uri "$BaseUrl/api/health/live" -UseBasicParsing -TimeoutSec 10 | Out-Null
Invoke-WebRequest -Uri "$BaseUrl/api/health/ping" -UseBasicParsing -TimeoutSec 10 | Out-Null
Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 10 | Out-Null

Write-Output "Checking infrastructure services..."
Invoke-DockerCompose @("exec", "-T", "postgres", "psql", "-U", "app", "-d", "appdb", "-c", "SELECT 1;") | Out-Null
Invoke-DockerCompose @("exec", "-T", "nats", "wget", "-qO-", "http://localhost:8222/healthz") | Out-Null
$redisPing = Invoke-DockerCompose @("exec", "-T", "redis", "redis-cli", "ping")
if (($redisPing -join "`n") -notmatch "PONG") {
  throw "Redis ping did not return PONG."
}
Invoke-DockerCompose @("exec", "-T", "minio", "curl", "-fsS", "http://localhost:9000/minio/health/live") | Out-Null

Write-Output "Running authenticated API scenario..."
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "deployment-smoke-$stamp-$PID@example.com"
$password = "SmokeTestPassword123!"

$registerBody = @{ email = $email; password = $password } | ConvertTo-Json
$register = Invoke-RestMethod -TimeoutSec 20 -Method Post -Uri "$BaseUrl/api/v1/auth/register" -ContentType "application/json" -Body $registerBody
$headers = @{ Authorization = "Bearer $($register.accessToken)" }
$organizationId = $register.organization.id

$workspaceBody = @{ name = "Deployment smoke $stamp"; description = "Automated deployment smoke test" } | ConvertTo-Json
$workspace = Invoke-RestMethod -TimeoutSec 20 -Method Post -Uri "$BaseUrl/api/v1/workspaces?organizationId=$organizationId" -Headers $headers -ContentType "application/json" -Body $workspaceBody

$taskBody = @{
  taskType = "chat"
  payload = @{ message = "deployment smoke test" }
  idempotencyKey = "deployment-smoke-$stamp"
} | ConvertTo-Json -Depth 5
$task = Invoke-RestMethod -TimeoutSec 20 -Method Post -Uri "$BaseUrl/api/v1/workspaces/$($workspace.id)/ai/tasks" -Headers $headers -ContentType "application/json" -Body $taskBody
Invoke-RestMethod -TimeoutSec 20 -Method Post -Uri "$BaseUrl/api/v1/workspaces/$($workspace.id)/ai/tasks/$($task.id)/cancel" -Headers $headers | Out-Null

Write-Output "Deployment smoke test passed."
Write-Output "Validated health, PostgreSQL, NATS, Redis, MinIO, auth registration, workspace creation, and AI task cancel."
