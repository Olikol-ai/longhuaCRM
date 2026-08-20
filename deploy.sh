#!/usr/bin/env bash
# =============================================================================
# LongHuaCRM — safe one-command server deploy
# Usage:
#   cd /opt/longhuaCRM && ./deploy.sh
#   CRM_DIR="$(pwd)" ./deploy.sh --dry-run   # local validation only
# =============================================================================
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/longhuaCRM}"
BRANCH="${BRANCH:-refactor/nestjs}"
SCREEN_NAME="${SCREEN_NAME:-longhua}"
API_PORT="${API_PORT:-3001}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${API_PORT}/api/health/ready}"
HEALTH_LIVE_URL="${HEALTH_LIVE_URL:-http://127.0.0.1:${API_PORT}/api/health/live}"
# Production deploy must not migrate without a backup unless explicitly skipped.
BACKUP_REQUIRED="${BACKUP_REQUIRED:-1}"
LOG_DIR=""
LOG_FILE=""
DRY_RUN=0
COMMIT_BEFORE=""
COMMIT_AFTER=""

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--dry-run] [--help]

  --dry-run   Validate environment and print planned steps without
              stopping processes, pulling, installing, migrating, or starting.
  --help      Show this help.

Environment overrides (see .env.example):
  CRM_DIR=/opt/longhuaCRM
  BRANCH=refactor/nestjs
  SCREEN_NAME=longhua
  API_PORT=3001
  HEALTH_URL=http://127.0.0.1:3001/api/health/ready
  HEALTH_LIVE_URL=http://127.0.0.1:3001/api/health/live
  BACKUP_REQUIRED=1                 abort if pre-migration backup fails (default)
  SKIP_PRE_MIGRATION_BACKUP=1       emergency only
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  if [[ -n "${LOG_FILE}" ]]; then
    echo "$msg" >>"$LOG_FILE"
  fi
}

die() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
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
  die "$label failed after ${timeout_s}s: $url"
}

abs_path() {
  # Portable absolute path without requiring GNU readlink -f
  (cd "$1" && pwd -P)
}

# --- 1. Directory check -------------------------------------------------------
if [[ ! -d "$CRM_DIR" ]]; then
  die "CRM directory does not exist: $CRM_DIR"
fi

CRM_DIR="$(abs_path "$CRM_DIR")"
CURRENT_DIR="$(abs_path "$(pwd)")"

if [[ "$CURRENT_DIR" != "$CRM_DIR" ]]; then
  die "Deploy must be run from $CRM_DIR (current: $CURRENT_DIR). Use: cd $CRM_DIR && ./deploy.sh"
fi

cd "$CRM_DIR"

mkdir -p logs
LOG_DIR="$CRM_DIR/logs"
LOG_FILE="$LOG_DIR/deploy.log"

log "======= LongHuaCRM deploy start ======="
log "CRM_DIR=$CRM_DIR BRANCH=$BRANCH SCREEN_NAME=$SCREEN_NAME DRY_RUN=$DRY_RUN"

require_cmd git
require_cmd npm
require_cmd ps
require_cmd awk

if [[ ! -d .git ]]; then
  die "Not a git repository: $CRM_DIR"
fi

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  die "Unable to determine current git branch (detached HEAD?)"
fi

if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  die "Expected branch '$BRANCH', current is '$CURRENT_BRANCH'. Aborting."
fi

COMMIT_BEFORE="$(git rev-parse --short HEAD)"
log "Current branch=$CURRENT_BRANCH commit=$COMMIT_BEFORE"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "WARNING: working tree is dirty (dry-run continues; real deploy would abort)"
  else
    die "Есть локальные изменения, требуется ручное решение"
  fi
fi

# --- Process helpers (LongHuaCRM only) ----------------------------------------
# Match only CRM-related process command lines. Never kill generic "node".
crm_pgrep() {
  # shellcheck disable=SC2009
  ps -eo pid=,args= 2>/dev/null | while read -r pid args; do
    case "$args" in
      *Rocket.Chat*|*rocketchat*|*wekan*|*Wekan*)
        continue
        ;;
    esac
    case "$args" in
      *concurrently*"dev:server"*|*"npm run dev"*|*"npm run dev:server"*|*"npm run dev:client"*)
        echo "$pid $args"
        ;;
      *vite*|*"/node_modules/.bin/vite"*|*"node_modules/vite/"*)
        # Only Vite started from this CRM tree
        case "$args" in
          *"$CRM_DIR"*|*longhuaCRM*|*LongHuaCRM*) echo "$pid $args" ;;
        esac
        ;;
      *nest*"start"*|*"@nestjs/cli"*|*"apps/api"*nest*)
        case "$args" in
          *"$CRM_DIR"*|*longhuaCRM*|*LongHuaCRM*|*apps/api*) echo "$pid $args" ;;
        esac
        ;;
      *cloudflared*"tunnel run"*|*scripts/run-cloudflare-tunnel.sh*)
        echo "$pid $args"
        ;;
      *"$CRM_DIR"*/*node*)
        # node workers launched from CRM dir (nest/vite children)
        case "$args" in
          *rocketchat*|*Rocket.Chat*|*wekan*) ;;
          *) echo "$pid $args" ;;
        esac
        ;;
    esac
  done
}

list_crm_pids() {
  crm_pgrep | awk '{print $1}' | sort -u
}

stop_crm_processes() {
  local pids
  pids="$(list_crm_pids || true)"
  if [[ -z "${pids//[$'\n\r']/}" ]]; then
    log "No running LongHuaCRM processes found"
    return 0
  fi

  log "Stopping LongHuaCRM processes (SIGTERM):"
  while read -r line; do
    [[ -z "$line" ]] && continue
    log "  TERM $line"
  done < <(crm_pgrep || true)

  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  sleep 5

  pids="$(list_crm_pids || true)"
  if [[ -n "${pids//[$'\n\r']/}" ]]; then
    log "Processes still alive — sending SIGKILL:"
    while read -r line; do
      [[ -z "$line" ]] && continue
      log "  KILL $line"
    done < <(crm_pgrep || true)
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
    sleep 1
  fi

  if [[ -n "$(list_crm_pids || true)" ]]; then
    die "Failed to stop all LongHuaCRM processes"
  fi
  log "LongHuaCRM processes stopped"
}

quit_crm_screen() {
  if ! command -v screen >/dev/null 2>&1; then
    return 0
  fi
  if screen -ls 2>/dev/null | grep -E "\.${SCREEN_NAME}([[:space:]]|$)" >/dev/null 2>&1; then
    log "Closing existing screen session: $SCREEN_NAME"
    screen -S "$SCREEN_NAME" -X quit >/dev/null 2>&1 || true
    sleep 1
  fi
}

# systemd runtime unit (autostart after reboot). Deploy must stop it first so
# Restart=on-failure does not race with git pull / migrate / build.
systemd_runtime_available() {
  command -v systemctl >/dev/null 2>&1 || return 1
  systemctl cat longhua.service >/dev/null 2>&1
}

stop_systemd_runtime() {
  if ! systemd_runtime_available; then
    return 0
  fi
  if systemctl is-active --quiet longhua.service 2>/dev/null \
    || systemctl is-failed --quiet longhua.service 2>/dev/null; then
    log "Stopping systemd unit longhua.service (avoid restart race during deploy)"
    if sudo -n systemctl stop longhua.service >/dev/null 2>&1; then
      log "systemd longhua.service stopped"
      return 0
    fi
    die "longhua.service is installed but could not be stopped (need: sudo systemctl stop longhua). Install sudoers via scripts/install-longhua-systemd.sh"
  fi
}

start_systemd_runtime() {
  if ! systemd_runtime_available; then
    return 1
  fi
  log "Starting Longhua stack via systemd unit longhua.service (npm run dev)"
  if ! sudo -n systemctl start longhua.service >/dev/null 2>&1; then
    die "Failed to start longhua.service (need passwordless systemctl — re-run: sudo ./scripts/install-longhua-systemd.sh)"
  fi
  # Wait until screen session exists (unit creates it)
  local elapsed=0
  while (( elapsed < 60 )); do
    if screen -ls 2>/dev/null | grep -E "\.${SCREEN_NAME}([[:space:]]|$)" >/dev/null 2>&1; then
      log "Screen session '$SCREEN_NAME' is up (via systemd)"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  die "longhua.service started but screen session '$SCREEN_NAME' did not appear"
}

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "DRY-RUN: processes that would be stopped:"
  if [[ -z "$(crm_pgrep || true)" ]]; then
    log "  (none)"
  else
    while read -r line; do
      [[ -z "$line" ]] && continue
      log "  $line"
    done < <(crm_pgrep || true)
  fi
  log "DRY-RUN: would take pre-migration backup (BACKUP_REQUIRED=$BACKUP_REQUIRED)"
  log "DRY-RUN: would fetch/pull origin/$BRANCH"
  log "DRY-RUN: would npm install (+ apps/api)"
  log "DRY-RUN: would run migrations"
  log "DRY-RUN: would build:api and build:client"
  if systemd_runtime_available; then
    log "DRY-RUN: would stop/start systemd unit longhua.service (screen '$SCREEN_NAME' → npm run dev)"
  else
    log "DRY-RUN: would restart screen '$SCREEN_NAME' via scripts/longhua-screen-runtime.sh (npm run dev)"
  fi
  log "DRY-RUN: runtime command: npm run dev (concurrently: API + Vite + cloudflared; NODE_ENV from .env)"
  log "DRY-RUN: would require $HEALTH_LIVE_URL (live) and $HEALTH_URL (ready) on port $API_PORT"
  log "======= LongHuaCRM dry-run finished (no changes) ======="
  exit 0
fi

# Real deploy needs server tooling
require_cmd ss
require_cmd curl
require_cmd screen
require_cmd kill
require_cmd sleep

# --- 3. Stop current app ------------------------------------------------------
# Prefer stopping systemd first so Restart= does not respawn mid-deploy.
stop_systemd_runtime
quit_crm_screen
stop_crm_processes

# --- 4. Update code -----------------------------------------------------------
log "Fetching origin..."
git fetch origin

if [[ -n "$(git status --porcelain)" ]]; then
  die "Есть локальные изменения, требуется ручное решение"
fi

log "Pulling origin/$BRANCH..."
git pull origin "$BRANCH"
COMMIT_AFTER="$(git rev-parse --short HEAD)"
log "Pull OK: $COMMIT_BEFORE -> $COMMIT_AFTER"

# --- 5. Dependencies ----------------------------------------------------------
log "Installing root dependencies..."
npm install
log "Installing apps/api dependencies..."
npm install --prefix apps/api
log "npm install OK"

# --- 6. Pre-migration backup --------------------------------------------------
if [[ "${SKIP_PRE_MIGRATION_BACKUP:-0}" == "1" ]]; then
  if [[ "$BACKUP_REQUIRED" == "1" ]]; then
    die "SKIP_PRE_MIGRATION_BACKUP=1 is incompatible with BACKUP_REQUIRED=1"
  fi
  log "Skipping pre-migration backup (SKIP_PRE_MIGRATION_BACKUP=1)"
else
  if ! command -v pg_dump >/dev/null 2>&1; then
    if [[ "$BACKUP_REQUIRED" == "1" ]]; then
      die "BACKUP_REQUIRED=1 but pg_dump is not installed — aborting before migration"
    fi
    log "WARNING: pg_dump not installed — continuing without backup"
  else
    log "Pre-migration database backup..."
    if BACKUP_DIR="$CRM_DIR/backups/pre-deploy" bash "$CRM_DIR/scripts/backup-db.sh"; then
      log "Pre-migration backup OK"
    else
      if [[ "$BACKUP_REQUIRED" == "1" ]]; then
        die "BACKUP_REQUIRED=1 but backup failed — aborting deploy"
      fi
      log "WARNING: pre-migration backup failed — continuing"
    fi
  fi
fi

# --- 7. Migrations ------------------------------------------------------------
log "Running database migrations..."
if ! npm run migration:run --prefix apps/api; then
  die "Migration failed — application will NOT be started"
fi
log "Migrations OK"

# --- 8. Build check -----------------------------------------------------------
log "Building API..."
if ! npm run build:api; then
  die "build:api failed — application will NOT be started"
fi
log "Building client..."
if ! npm run build:client; then
  die "build:client failed — application will NOT be started"
fi
log "Build OK"

# --- 9. Start runtime (npm run dev via systemd / screen) ----------------------
quit_crm_screen
# Ensure no leftover CRM processes before start (idempotent)
stop_crm_processes

# Prefer systemd runtime when installed (reboot autostart).
# Screen command: npm run dev → backend + frontend + cloudflared.
if ! start_systemd_runtime; then
  log "Starting application in screen '$SCREEN_NAME' (npm run dev, legacy path)..."
  if [[ ! -x "$CRM_DIR/scripts/longhua-screen-runtime.sh" ]]; then
    die "Missing runtime helper: $CRM_DIR/scripts/longhua-screen-runtime.sh"
  fi
  SCREEN_NAME="$SCREEN_NAME" CRM_DIR="$CRM_DIR" \
    "$CRM_DIR/scripts/longhua-screen-runtime.sh" start-detached

  sleep 2
  if ! screen -ls 2>/dev/null | grep -E "\.${SCREEN_NAME}([[:space:]]|$)" >/dev/null 2>&1; then
    die "Failed to create screen session '$SCREEN_NAME'"
  fi
  log "Screen session '$SCREEN_NAME' started"
fi

# --- 10. Post-start checks ----------------------------------------------------
log "Waiting for API health probes..."
wait_http "$HEALTH_LIVE_URL" "Liveness" 60
wait_http "$HEALTH_URL" "Readiness" 30

if ss -tulpn 2>/dev/null | grep -E ":${API_PORT}\\b" >/dev/null 2>&1; then
  log "Port $API_PORT is listening"
else
  log "WARNING: port $API_PORT not found in ss output (health probes passed)"
fi

log "======= LongHuaCRM deploy finished (commit=$COMMIT_AFTER) ======="
log "Attach: screen -r $SCREEN_NAME"
log "Log:    $LOG_FILE"
