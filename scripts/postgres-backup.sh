#!/usr/bin/env bash
# =============================================================================
# LonghuaCRM — daily PostgreSQL backup (pg_dump → gzip)
#
# Safe for production:
#   - does not stop PostgreSQL
#   - does not modify application data
#   - writes only to the backup disk (/mnt/storage)
#   - never deletes old dumps unless the new dump is verified
#
# Manual run:
#   /opt/longhuaCRM/scripts/postgres-backup.sh
#
# Env overrides (optional):
#   BACKUP_DIR, LOG_FILE, KEEP_COUNT, POSTGRES_CONTAINER,
#   POSTGRES_DB, POSTGRES_USER
# =============================================================================

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_BACKUP_DIR="/mnt/storage/backups/postgres"
readonly DEFAULT_LOG_FILE="/mnt/storage/logs/backup.log"
readonly DEFAULT_KEEP_COUNT=30
readonly CONTAINER="${POSTGRES_CONTAINER:-longhua-postgres}"
readonly DB_NAME="${POSTGRES_DB:-longhua}"
readonly DB_USER="${POSTGRES_USER:-postgres}"

BACKUP_DIR="${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"
LOG_FILE="${LOG_FILE:-$DEFAULT_LOG_FILE}"
KEEP_COUNT="${KEEP_COUNT:-$DEFAULT_KEEP_COUNT}"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"
BACKUP_BASENAME="longhua_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}"
TMP_PATH="${BACKUP_PATH}.partial"

log() {
  local level="$1"
  shift
  local msg="$*"
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S %Z') [${level}] ${msg}"
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "$line" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR" "$*"
  # Never leave a partial file behind as a "valid" backup.
  rm -f "$TMP_PATH"
  exit 1
}

bytes_human() {
  local bytes="$1"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --suffix=B "$bytes"
  else
    echo "${bytes}B"
  fi
}

require_prereqs() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed or not in PATH"
  command -v gzip >/dev/null 2>&1 || fail "gzip is not installed"
  docker inspect "$CONTAINER" >/dev/null 2>&1 || fail "container '$CONTAINER' not found"
  docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
    || fail "PostgreSQL in '$CONTAINER' is not ready"
}

create_backup() {
  mkdir -p "$BACKUP_DIR"
  chmod 750 "$BACKUP_DIR" 2>/dev/null || true

  log "INFO" "Starting backup: db=${DB_NAME} container=${CONTAINER} → ${BACKUP_PATH}"

  # Plain SQL dump streamed to host and gzip-compressed.
  # pipefail ensures a non-zero pg_dump exit fails the whole pipeline.
  if ! docker exec "$CONTAINER" \
      pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-acl \
      2>>"$LOG_FILE" \
      | gzip -c > "$TMP_PATH"
  then
    fail "pg_dump | gzip failed (exit non-zero)"
  fi

  # Atomic publish: only rename after the stream finished successfully.
  mv -f "$TMP_PATH" "$BACKUP_PATH"
}

verify_backup() {
  [[ -f "$BACKUP_PATH" ]] || fail "Backup file missing after dump: $BACKUP_PATH"

  local size
  size="$(stat -c%s "$BACKUP_PATH" 2>/dev/null || stat -f%z "$BACKUP_PATH")"
  [[ "$size" -gt 0 ]] || fail "Backup file is empty (0 bytes): $BACKUP_PATH"

  gzip -t "$BACKUP_PATH" || fail "gzip integrity check failed: $BACKUP_PATH"

  # Sanity: dump should look like SQL (not binary garbage).
  local head_sample
  head_sample="$(gzip -dc "$BACKUP_PATH" | head -c 200 || true)"
  if ! grep -qE 'PostgreSQL database dump|CREATE |SET ' <<<"$head_sample"; then
    fail "Backup content does not look like a PostgreSQL SQL dump"
  fi

  log "INFO" "Backup verified OK: file=${BACKUP_BASENAME} size=$(bytes_human "$size") (${size} bytes)"
}

prune_old_backups() {
  local -a files=()
  # Newest first.
  while IFS= read -r f; do
    [[ -n "$f" ]] && files+=("$f")
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'longhua_backup_*.sql.gz' -printf '%T@ %p\n' \
            | sort -nr | cut -d' ' -f2-)

  local total="${#files[@]}"
  if (( total <= KEEP_COUNT )); then
    log "INFO" "Retention: ${total} backup(s) present (keep=${KEEP_COUNT}) — nothing to delete"
    return 0
  fi

  local -a to_delete=("${files[@]:KEEP_COUNT}")
  log "INFO" "Retention: deleting $(( total - KEEP_COUNT )) old backup(s), keeping ${KEEP_COUNT}"
  local old
  for old in "${to_delete[@]}"; do
    rm -f -- "$old"
    log "INFO" "Deleted old backup: $(basename "$old")"
  done
}

main() {
  log "INFO" "===== ${SCRIPT_NAME} start ====="
  require_prereqs
  create_backup
  verify_backup
  # Prune ONLY after a verified successful backup.
  prune_old_backups
  log "INFO" "===== ${SCRIPT_NAME} success ====="
}

main "$@"
