#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────
APP_NAME="FlowForge Backend"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
COMPOSE_PROFILE="core"
API_PORT=3000
HEALTH_URL="http://localhost:${API_PORT}/api/health/live"
READY_URL="http://localhost:${API_PORT}/api/health/ready"
POLL_INTERVAL=5
MAX_RETRIES=24

TUNNEL_MODE="${1:-}"
SCRIPT_NAME="$(basename "$0")"

# ─── Color helpers ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

# ─── Usage ─────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <tunnel-mode>

Tunnel modes:
  cloudflared   Start a Cloudflare Quick Tunnel (preferred)
  ngrok         Start an ngrok HTTP tunnel to port ${API_PORT}
  localtunnel   Start a LocalTunnel via npx
  none          Print instructions without starting a tunnel

Prerequisites:
  - Docker and Docker Compose plugin
  - ${ENV_FILE} with DEV_BYPASS_AUTH=false and generated secrets
EOF
  exit 1
}

# ─── Step 1: Validate environment ──────────────────────────────────────
validate_env() {
  info "Step 1: Validating environment …"

  if ! command -v docker &>/dev/null; then
    err "Docker is required but not found."
    exit 1
  fi
  docker compose version &>/dev/null || {
    err "Docker Compose plugin is required but not found."
    exit 1
  }
  ok "Docker and Compose available."

  if [[ ! -f "${ENV_FILE}" ]]; then
    err "${ENV_FILE} not found. Create it from .env.docker.example:"
    err "  cp .env.docker.example ${ENV_FILE}"
    err "  # Then edit secrets (openssl rand -hex 32 for each)"
    exit 1
  fi
  ok "${ENV_FILE} exists."

  if grep -qE '^DEV_BYPASS_AUTH=true' "${ENV_FILE}"; then
    err "DEV_BYPASS_AUTH=true is set in ${ENV_FILE}."
    err "Set DEV_BYPASS_AUTH=false before exposing the backend."
    exit 1
  fi
  ok "DEV_BYPASS_AUTH is not true."

  # Warn about placeholder secrets
  local placeholders=0
  for var in APP_DB_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET INTERNAL_AUTH_SECRET MINIO_ROOT_PASSWORD; do
    # shellcheck disable=SC2002
    val=$(grep "^${var}=" "${ENV_FILE}" | cut -d= -f2-)
    if [[ -z "${val}" || "${val}" == *placeholder* || "${val}" == *change-me* || "${val}" == *replace-me* ]]; then
      warn "${var} appears to be a placeholder in ${ENV_FILE}."
      placeholders=$((placeholders + 1))
    fi
  done
  if [[ $placeholders -gt 0 ]]; then
    warn "${placeholders} variable(s) still use placeholders. Generate real secrets with:"
    warn "  openssl rand -hex 32"
  fi
}

# ─── Step 2: Build images ──────────────────────────────────────────────
build_images() {
  info "Step 2: Building Docker images …"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build backend backend-migrate
  ok "Docker images built."
}

# ─── Step 3: Start core profile ────────────────────────────────────────
start_services() {
  info "Step 3: Starting core services (profile: ${COMPOSE_PROFILE}) …"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" --profile "${COMPOSE_PROFILE}" up -d
}

# ─── Step 4: Wait for backend health ───────────────────────────────────
wait_healthy() {
  info "Step 4: Waiting for backend to become healthy …"
  local retries=0
  until curl -fsS "${HEALTH_URL}" &>/dev/null; do
    retries=$((retries + 1))
    if [[ $retries -ge $MAX_RETRIES ]]; then
      err "Backend did not become healthy after $((MAX_RETRIES * POLL_INTERVAL)) seconds."
      err "Check logs: docker compose --env-file ${ENV_FILE} logs --tail=100 backend"
      exit 1
    fi
    warn "Not ready yet (attempt ${retries}/${MAX_RETRIES}) …"
    sleep "${POLL_INTERVAL}"
  done
  ok "Backend live endpoint responds."

  # Check ready endpoint for dependency health
  if curl -fsS "${READY_URL}" &>/dev/null; then
    local deps
    deps=$(curl -sS "${READY_URL}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
deps=d.get('dependencies',{})
status=d.get('status','unknown')
print(status)
for name,dep in deps.items():
    print(f'  {name}: {dep.get(\"status\",\"unknown\")}')" 2>/dev/null || echo "unknown")
    if echo "${deps}" | head -1 | grep -q 'ok'; then
      ok "Ready endpoint — all dependencies up:"
      echo "${deps}" | tail -n +2
    else
      warn "Ready endpoint status:"
      echo "${deps}"
    fi
  else
    warn "Ready endpoint not responding yet."
  fi
}

# ─── Step 5: Start tunnel ──────────────────────────────────────────────
start_tunnel() {
  info "Step 5: Starting tunnel (mode: ${TUNNEL_MODE}) …"

  case "${TUNNEL_MODE}" in
    cloudflared)
      if command -v cloudflared &>/dev/null; then
        TUNNEL_CMD="cloudflared tunnel --url http://localhost:${API_PORT}"
      elif [[ -x /tmp/cloudflared ]]; then
        TUNNEL_CMD="/tmp/cloudflared tunnel --url http://localhost:${API_PORT}"
      else
        err "cloudflared not found. Install it:"
        err "  sudo apt-get install cloudflared"
        err "  # or: curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared"
        exit 1
      fi
      ok "Starting Cloudflare Quick Tunnel …"
      echo ""
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo -e "${GREEN}  Cloudflare tunnel starting — URL will appear above.${NC}"
      echo -e "${GREEN}  Keep this terminal open while testing.${NC}"
      echo -e "${GREEN}  Stop with Ctrl+C.${NC}"
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo ""
      ${TUNNEL_CMD}
      ;;
    ngrok)
      if ! command -v ngrok &>/dev/null; then
        err "ngrok not found. Install it from https://ngrok.com/download"
        exit 1
      fi
      ok "Starting ngrok tunnel to port ${API_PORT} …"
      echo ""
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo -e "${GREEN}  ngrok tunnel starting. Open http://localhost:4040${NC}"
      echo -e "${GREEN}  to see the public URL in the ngrok dashboard.${NC}"
      echo -e "${GREEN}  Keep this terminal open while testing.${NC}"
      echo -e "${GREEN}  Stop with Ctrl+C.${NC}"
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo ""
      ngrok http "${API_PORT}"
      ;;
    localtunnel)
      if ! command -v npx &>/dev/null; then
        err "npx not found. Install Node.js or use a different tunnel mode."
        exit 1
      fi
      ok "Starting LocalTunnel via npx …"
      echo ""
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo -e "${GREEN}  LocalTunnel will print the public URL.${NC}"
      echo -e "${GREEN}  Keep this terminal open while testing.${NC}"
      echo -e "${GREEN}  Stop with Ctrl+C.${NC}"
      echo -e "${GREEN}────────────────────────────────────────────────────────────${NC}"
      echo ""
      npx localtunnel --port "${API_PORT}"
      ;;
    none)
      info "No tunnel mode selected. Backend is available at:"
      echo "  http://localhost:${API_PORT}"
      echo ""
      info "To expose publicly, run one of:"
      echo "  ${SCRIPT_NAME} cloudflared"
      echo "  ${SCRIPT_NAME} ngrok"
      echo "  ${SCRIPT_NAME} localtunnel"
      ;;
    *)
      usage
      ;;
  esac
}

# ─── Main ──────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  ${APP_NAME} — Expose for Testing${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
  echo ""

  if [[ -z "${TUNNEL_MODE}" ]]; then
    usage
  fi

  validate_env
  echo ""
  build_images
  echo ""
  start_services
  echo ""
  wait_healthy
  echo ""
  start_tunnel
}

main
