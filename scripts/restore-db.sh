#!/usr/bin/env bash
# Restore PostgreSQL database for LonghuaCRM from a custom-format dump (.dump).
# WARNING: overwrites the target database. Use only on staging or after backup.
#
# Usage:
#   ./scripts/restore-db.sh backups/longhua-20260101-120000.dump
#   ./scripts/restore-db.sh --docker backups/longhua-20260101-120000.dump

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 [--docker] <backup-file.dump>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USE_DOCKER=false
DUMP_FILE=""

for arg in "$@"; do
  if [[ "$arg" == "--docker" ]]; then
    USE_DOCKER=true
  else
    DUMP_FILE="$arg"
  fi
done

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: backup file not found: $DUMP_FILE" >&2
  exit 1
fi

read -r -p "This will REPLACE the database. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

if [[ "$USE_DOCKER" == true ]]; then
  CONTAINER="${POSTGRES_CONTAINER:-longhua-postgres}"
  DB_NAME="${POSTGRES_DB:-longhua}"
  DB_USER="${POSTGRES_USER:-postgres}"
  REMOTE="/tmp/restore.dump"
  docker cp "$DUMP_FILE" "$CONTAINER:$REMOTE"
  docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$REMOTE"
  docker exec "$CONTAINER" rm -f "$REMOTE"
  echo "Restore completed from $DUMP_FILE"
  exit 0
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ROOT_DIR/.env"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

pg_restore -d "$DATABASE_URL" --clean --if-exists "$DUMP_FILE"
echo "Restore completed from $DUMP_FILE"
