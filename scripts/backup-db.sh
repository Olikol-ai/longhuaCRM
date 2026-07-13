#!/usr/bin/env bash
# Backup PostgreSQL database for LonghuaCRM.
# Usage:
#   ./scripts/backup-db.sh
#   DATABASE_URL=postgresql://... ./scripts/backup-db.sh
#   ./scripts/backup-db.sh --docker   # via docker compose postgres container

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="$BACKUP_DIR/longhua-$TIMESTAMP.dump"
USE_DOCKER=false

for arg in "$@"; do
  if [[ "$arg" == "--docker" ]]; then
    USE_DOCKER=true
  fi
done

mkdir -p "$BACKUP_DIR"

if [[ "$USE_DOCKER" == true ]]; then
  CONTAINER="${POSTGRES_CONTAINER:-longhua-postgres}"
  DB_NAME="${POSTGRES_DB:-longhua}"
  DB_USER="${POSTGRES_USER:-postgres}"
  docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/backup-$TIMESTAMP.dump"
  docker cp "$CONTAINER:/tmp/backup-$TIMESTAMP.dump" "$OUTPUT_FILE"
  docker exec "$CONTAINER" rm -f "/tmp/backup-$TIMESTAMP.dump"
  echo "Backup saved: $OUTPUT_FILE"
  exit 0
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ROOT_DIR/.env" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$ROOT_DIR/.env"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Use .env, export DATABASE_URL, or pass --docker." >&2
  exit 1
fi

pg_dump "$DATABASE_URL" -Fc -f "$OUTPUT_FILE"
echo "Backup saved: $OUTPUT_FILE"
