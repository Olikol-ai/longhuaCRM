#!/usr/bin/env bash
# =============================================================================
# LonghuaCRM — systemd + screen runtime (canonical: npm run dev)
#
# Starts a single screen session named "longhua" running:
#   npm run dev
# which is concurrently:
#   - npm run dev:server  (Nest watch + migrations)
#   - npm run dev:client  (Vite)
#   - npm run tunnel      (cloudflared)
#
# Usage:
#   scripts/longhua-screen-runtime.sh start     # systemd Type=simple (blocks)
#   scripts/longhua-screen-runtime.sh start-detached
#   scripts/longhua-screen-runtime.sh stop
#   scripts/longhua-screen-runtime.sh status
# =============================================================================
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/longhuaCRM}"
SCREEN_NAME="${SCREEN_NAME:-longhua}"
ACTION="${1:-start}"
HEALTH_LIVE_URL="${HEALTH_LIVE_URL:-http://127.0.0.1:3001/api/health/live}"
HEALTH_READY_URL="${HEALTH_READY_URL:-http://127.0.0.1:3001/api/health/ready}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-180}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:5173/}"
STOP_MARKER="${CRM_DIR}/logs/.longhua-systemd-stopping"

log() {
  echo "[longhua-runtime $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

ensure_node_path() {
  export NVM_DIR="${NVM_DIR:-${HOME:-/home/ilya}/.nvm}"
  if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh" >/dev/null 2>&1 || true
  fi

  local nvm_node_bin=""
  if [[ -n "${NVM_BIN:-}" && -x "${NVM_BIN}/node" ]]; then
    nvm_node_bin="$NVM_BIN"
  elif [[ -x "${HOME:-/home/ilya}/.nvm/versions/node/v24.18.0/bin/node" ]]; then
    nvm_node_bin="${HOME:-/home/ilya}/.nvm/versions/node/v24.18.0/bin"
  else
    local candidate
    candidate="$(ls -1d "${HOME:-/home/ilya}/.nvm/versions/node"/v*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
    if [[ -n "$candidate" && -x "${candidate}/node" ]]; then
      nvm_node_bin="$candidate"
    fi
  fi

  if [[ -n "$nvm_node_bin" ]]; then
    export PATH="${nvm_node_bin}:/usr/local/bin:/usr/bin:/bin"
  else
    export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
  fi

  command -v node >/dev/null 2>&1 || {
    log "ERROR: node not found in PATH=$PATH"
    exit 1
  }
  command -v npm >/dev/null 2>&1 || {
    log "ERROR: npm not found in PATH=$PATH"
    exit 1
  }
  command -v screen >/dev/null 2>&1 || {
    log "ERROR: screen not found"
    exit 1
  }
}

# Load .env without bash-sourcing (MAIL_FROM etc. may contain < > spaces).
# Does NOT print secret values. Does NOT force NODE_ENV=production.
write_env_exports() {
  local env_file="${CRM_DIR}/.env"
  local out_file="$1"
  if [[ ! -f "$env_file" ]]; then
    log "ERROR: missing ${env_file}"
    exit 1
  fi
  ENV_FILE="$env_file" OUT_FILE="$out_file" node <<'NODE'
const fs = require('fs');
const envFile = process.env.ENV_FILE;
const outFile = process.env.OUT_FILE;
const text = fs.readFileSync(envFile, 'utf8');
const lines = [];
for (const rawLine of text.split(/\n/)) {
  const line = rawLine.replace(/\r$/, '');
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq <= 0) continue;
  const key = line.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  let value = line.slice(eq + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  lines.push(`export ${key}=${JSON.stringify(value)}`);
}
fs.writeFileSync(outFile, lines.join('\n') + '\n', { mode: 0o600 });
NODE
}

screen_exists() {
  screen -ls 2>/dev/null | grep -E "\.${SCREEN_NAME}([[:space:]]|$)" >/dev/null 2>&1
}

# Match Longhua CRM processes only (same spirit as deploy.sh). Never kill unrelated node apps.
list_crm_pids() {
  # shellcheck disable=SC2009
  ps -eo pid=,args= 2>/dev/null | while read -r pid args; do
    case "$args" in
      *Rocket.Chat*|*rocketchat*|*wekan*|*Wekan*) continue ;;
    esac
    case "$args" in
      *concurrently*"dev:server"*|*"npm run dev"*|*"npm run dev:server"*|*"npm run dev:client"*|*"npm run tunnel"*)
        echo "$pid"
        ;;
      *vite*|*"/node_modules/.bin/vite"*|*"node_modules/vite/"*)
        case "$args" in
          *"$CRM_DIR"*|*longhuaCRM*|*LongHuaCRM*) echo "$pid" ;;
        esac
        ;;
      *nest*"start"*|*"@nestjs/cli"*|*"apps/api"*nest*|*"start:dev"*)
        case "$args" in
          *"$CRM_DIR"*|*longhuaCRM*|*LongHuaCRM*|*apps/api*) echo "$pid" ;;
        esac
        ;;
      *cloudflared*"tunnel run"*|*scripts/run-cloudflare-tunnel.sh*)
        echo "$pid"
        ;;
      *"$CRM_DIR"*/*node*|*"$CRM_DIR"*npm*)
        case "$args" in
          *rocketchat*|*Rocket.Chat*|*wekan*) ;;
          *) echo "$pid" ;;
        esac
        ;;
    esac
  done | sort -u
}

stop_crm_orphans() {
  local pids
  pids="$(list_crm_pids || true)"
  if [[ -z "${pids//[$'\n\r']/}" ]]; then
    return 0
  fi
  log "Stopping leftover Longhua processes: $(echo "$pids" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  sleep 3
  pids="$(list_crm_pids || true)"
  if [[ -n "${pids//[$'\n\r']/}" ]]; then
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
    sleep 1
  fi
}

wait_http() {
  local url="$1"
  local label="$2"
  local timeout_s="${3:-60}"
  local elapsed=0
  while (( elapsed < timeout_s )); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      log "$label OK: $url"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  log "ERROR: $label failed after ${timeout_s}s: $url"
  return 1
}

start_screen_once() {
  ensure_node_path
  cd "$CRM_DIR"
  mkdir -p "$CRM_DIR/logs"

  if screen_exists; then
    log "screen session '${SCREEN_NAME}' already exists — not creating a duplicate"
    return 0
  fi

  # Clear orphans from a previous crash before creating a fresh screen.
  stop_crm_orphans

  local env_export_file
  env_export_file="$(mktemp /tmp/longhua-env.XXXXXX)"
  write_env_exports "$env_export_file"

  log "Starting screen '${SCREEN_NAME}' with: npm run dev"
  # Canonical stack launcher — do not duplicate concurrently children here.
  screen -dmS "$SCREEN_NAME" bash -lc "cd \"$CRM_DIR\" && export PATH=\"$PATH\" && . \"$env_export_file\" && rm -f \"$env_export_file\" && exec npm run dev"

  local i=0
  while ! screen_exists && (( i < 40 )); do
    sleep 0.25
    i=$((i + 1))
  done
  if ! screen_exists; then
    rm -f "$env_export_file" 2>/dev/null || true
    log "ERROR: failed to create screen session '${SCREEN_NAME}'"
    exit 1
  fi

  log "Waiting for API health (live + ready, timeout ${HEALTH_TIMEOUT_S}s)..."
  if ! wait_http "$HEALTH_LIVE_URL" "Liveness" "$HEALTH_TIMEOUT_S"; then
    stop_screen
    exit 1
  fi
  if ! wait_http "$HEALTH_READY_URL" "Readiness" 60; then
    stop_screen
    exit 1
  fi

  if curl -fsS --max-time 3 "$FRONTEND_URL" >/dev/null 2>&1; then
    log "Frontend OK: $FRONTEND_URL"
  else
    log "WARNING: frontend not responding yet at $FRONTEND_URL (Vite may still be compiling)"
  fi

  if pgrep -af 'cloudflared tunnel run' >/dev/null 2>&1; then
    log "cloudflared tunnel process is running"
  else
    log "WARNING: cloudflared tunnel process not detected yet"
  fi

  log "screen session '${SCREEN_NAME}' started (npm run dev)"
}

stop_screen() {
  log "Stopping screen '${SCREEN_NAME}' and Longhua processes"
  mkdir -p "$CRM_DIR/logs"
  touch "$STOP_MARKER"
  if screen_exists; then
    # Try graceful interrupt inside the session first (concurrently / nest / vite).
    screen -S "$SCREEN_NAME" -X stuff $'\003' >/dev/null 2>&1 || true
    sleep 2
    screen -S "$SCREEN_NAME" -X quit >/dev/null 2>&1 || true
    local i=0
    while screen_exists && (( i < 40 )); do
      sleep 0.25
      i=$((i + 1))
    done
  fi
  stop_crm_orphans
}

status_screen() {
  if screen_exists; then
    log "screen: ${SCREEN_NAME} (present)"
    screen -ls 2>/dev/null | grep -E "\.${SCREEN_NAME}([[:space:]]|$)" || true
    return 0
  fi
  log "screen: ${SCREEN_NAME} (absent)"
  return 1
}

wait_until_screen_gone() {
  while screen_exists; do
    sleep 2
  done
}

case "$ACTION" in
  start)
    rm -f "$STOP_MARKER"
    start_screen_once
    trap 'mkdir -p "$CRM_DIR/logs"; touch "$STOP_MARKER"; stop_screen; exit 0' TERM INT
    wait_until_screen_gone
    if [[ -f "$STOP_MARKER" ]]; then
      rm -f "$STOP_MARKER"
      log "screen session '${SCREEN_NAME}' stopped cleanly"
      exit 0
    fi
    log "screen session '${SCREEN_NAME}' ended unexpectedly"
    exit 1
    ;;
  start-detached)
    rm -f "$STOP_MARKER"
    start_screen_once
    ;;
  stop)
    stop_screen
    ;;
  status)
    status_screen
    ;;
  *)
    echo "Usage: $0 {start|start-detached|stop|status}" >&2
    exit 2
    ;;
esac
