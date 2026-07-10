param(
  [string]$BaseUrl = "http://localhost:3000/api"
)

$ErrorActionPreference = "Stop"

Invoke-RestMethod "$BaseUrl/health/live" | Out-Null
Invoke-RestMethod "$BaseUrl/health/ping" | Out-Null
$ready = Invoke-RestMethod "$BaseUrl/health/ready"
$health = Invoke-RestMethod "$BaseUrl/health"

if ($ready.status -ne "ok") {
  throw "ready status is $($ready.status)"
}

foreach ($service in @("postgres", "nats", "redis", "minio")) {
  $status = $ready.dependencies.$service.status
  if ($status -notin @("up", "ok")) {
    throw "$service readiness status is $status"
  }
}

if ($health.status -notin @("ok", "degraded")) {
  throw "aggregate health status is $($health.status)"
}

Write-Output "Health validation passed."
