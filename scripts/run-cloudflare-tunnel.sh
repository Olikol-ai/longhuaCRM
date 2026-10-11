#!/usr/bin/env bash
# Start Cloudflare Tunnel for LonghuaCRM (existing tunnel: longhua-dev).
#
# Production: systemd unit cloudflared-longhua.service
# Manual/dev: npm run tunnel
#
# Do NOT start this from npm run dev (avoids duplicate connectors).
#
# Force IPv4 + HTTP/2: auto edge discovery previously dialed a non-routable
# 172.31.255.254:7844 and never connected (Cloudflare Error 1033).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLOUDFLARED_BIN="$(command -v cloudflared || true)"
CONFIG_FILE="${CLOUDFLARED_CONFIG:-${HOME}/.cloudflared/config.yml}"
TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-longhua-dev}"

load_token_from_env_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  local line value
  line="$(grep -E '^[[:space:]]*CLOUDFLARE_TUNNEL_TOKEN=' "$env_file" | tail -n1 || true)"
  [[ -n "$line" ]] || return 0

  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  export CLOUDFLARE_TUNNEL_TOKEN="$value"
}

if [[ -z "${CLOUDFLARED_BIN}" ]]; then
  echo "ERROR: cloudflared is not installed or not on PATH." >&2
  exit 1
fi

# Prefer local credentials + config for the existing longhua-dev tunnel.
# This keeps ingress explicit (lk → 127.0.0.1:3001, /meet → :8000).
if [[ -f "$CONFIG_FILE" ]]; then
  echo "[tunnel] starting ${TUNNEL_NAME} via config ${CONFIG_FILE} (edge-ip-version=4, protocol=http2)"
  # Replace this process so SIGINT/SIGTERM from concurrently stop cloudflared.
  exec "$CLOUDFLARED_BIN" \
    --edge-ip-version 4 \
    tunnel \
    --config "$CONFIG_FILE" \
    --protocol http2 \
    run \
    "$TUNNEL_NAME"
fi

# Fallback: remoted-managed token from .env (same tunnel UUID).
if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  load_token_from_env_file "$ROOT_DIR/.env"
fi

if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: no tunnel config and CLOUDFLARE_TUNNEL_TOKEN is not set.

Expected either:
  ~/.cloudflared/config.yml + credentials for longhua-dev
or
  CLOUDFLARE_TUNNEL_TOKEN in .env

Do not commit the token to git.
EOF
  exit 1
fi

echo "[tunnel] starting via token fallback (edge-ip-version=4, protocol=http2)"
exec "$CLOUDFLARED_BIN" \
  --edge-ip-version 4 \
  tunnel \
  --protocol http2 \
  run \
  --token "$CLOUDFLARE_TUNNEL_TOKEN"
