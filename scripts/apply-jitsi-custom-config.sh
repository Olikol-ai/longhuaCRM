#!/usr/bin/env bash
# Copy Longhua Jitsi web overrides into the docker-jitsi-meet config volume and restart web.
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/longhuaCRM}"
SOURCE="${CRM_DIR}/jitsi/custom-config.js"
PLUGIN_HEAD_SOURCE="${CRM_DIR}/jitsi/plugin.head.html"
CONFIG_DIR="${CONFIG:-${HOME}/.jitsi-meet-cfg}"
TARGET="${CONFIG_DIR}/web/custom-config.js"
PLUGIN_HEAD_HOST="${CONFIG_DIR}/web/plugin.head.html"
COMPOSE_FILE="${CRM_DIR}/docker-compose.jitsi.yml"
ENV_FILE="${CRM_DIR}/.env.jitsi"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing source: $SOURCE" >&2
  exit 1
fi

mkdir -p "${CONFIG_DIR}/web"
cp "$SOURCE" "$TARGET"
echo "Installed ${TARGET}"

if [[ -f "$PLUGIN_HEAD_SOURCE" ]]; then
  cp "$PLUGIN_HEAD_SOURCE" "$PLUGIN_HEAD_HOST"
  echo "Installed ${PLUGIN_HEAD_HOST}"
fi

WEB_CONTAINER="${JITSI_WEB_CONTAINER:-longhuacrm-web-1}"
if docker ps --format '{{.Names}}' | grep -qx "$WEB_CONTAINER"; then
  if [[ -f "$PLUGIN_HEAD_SOURCE" ]]; then
    docker cp "$PLUGIN_HEAD_SOURCE" "${WEB_CONTAINER}:/usr/share/jitsi-meet/plugin.head.html"
    echo "Copied plugin.head.html into ${WEB_CONTAINER}"
  fi
fi

if [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart web
  echo "Restarted jitsi web container"
  # Re-apply plugin.head after restart (image may reset empty plugin.head.html).
  sleep 2
  if docker ps --format '{{.Names}}' | grep -qx "$WEB_CONTAINER" && [[ -f "$PLUGIN_HEAD_SOURCE" ]]; then
    docker cp "$PLUGIN_HEAD_SOURCE" "${WEB_CONTAINER}:/usr/share/jitsi-meet/plugin.head.html"
    echo "Re-applied plugin.head.html after restart"
  fi
else
  echo "Compose/env not found — restart jitsi web manually after copying overrides"
fi
