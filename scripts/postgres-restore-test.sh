#!/usr/bin/env bash
# =============================================================================
# LonghuaCRM — restore a gzipped SQL dump into a TEMPORARY test database.
#
# Does NOT touch the production database (longhua).
#
# Usage:
#   /opt/longhuaCRM/scripts/postgres-restore-test.sh /path/to/longhua_backup_....sql.gz
#
# Optional:
#   TEST_DB_NAME=longhua_restore_test_$$ ./scripts/postgres-restore-test.sh <file>
# =============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER="${POSTGRES_CONTAINER:-longhua-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
TEST_DB_NAME="${TEST_DB_NAME:-longhua_restore_test_$(date +%Y%m%d_%H%M%S)}"
LOG_FILE="${LOG_FILE:-/mnt/storage/logs/backup.log}"

log() {
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S %Z') [RESTORE-TEST] $*"
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "$line" | tee -a "$LOG_FILE"
}

[[ -f "$BACKUP_FILE" ]] || { echo "ERROR: file not found: $BACKUP_FILE" >&2; exit 1; }
gzip -t "$BACKUP_FILE" || { echo "ERROR: gzip integrity failed: $BACKUP_FILE" >&2; exit 1; }

docker exec "$CONTAINER" pg_isready -U "$DB_USER" >/dev/null \
  || { echo "ERROR: postgres not ready" >&2; exit 1; }

# Refuse to overwrite production DB name.
if [[ "$TEST_DB_NAME" == "longhua" || "$TEST_DB_NAME" == "postgres" ]]; then
  echo "ERROR: refusing to use production/system database name: $TEST_DB_NAME" >&2
  exit 1
fi

cleanup() {
  log "Dropping temporary database ${TEST_DB_NAME} (if exists)"
  docker exec "$CONTAINER" dropdb -U "$DB_USER" --if-exists "$TEST_DB_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT

log "Creating temporary database: ${TEST_DB_NAME}"
docker exec "$CONTAINER" createdb -U "$DB_USER" "$TEST_DB_NAME"

log "Restoring ${BACKUP_FILE} → ${TEST_DB_NAME}"
# ON_ERROR_STOP so any SQL error fails the pipeline.
if ! gzip -dc "$BACKUP_FILE" \
  | docker exec -i "$CONTAINER" \
      psql -U "$DB_USER" -d "$TEST_DB_NAME" -v ON_ERROR_STOP=1 -q
then
  log "ERROR: restore failed"
  exit 1
fi

TABLE_COUNT="$(
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"
DB_SIZE="$(
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB_NAME" -tAc \
    "SELECT pg_size_pretty(pg_database_size(current_database()));"
)"

log "Restore OK: public_tables=${TABLE_COUNT} size=${DB_SIZE}"
echo "SUCCESS: restored into temporary DB '${TEST_DB_NAME}' (will be dropped on exit)"
echo "public_tables=${TABLE_COUNT}"
echo "size=${DB_SIZE}"
