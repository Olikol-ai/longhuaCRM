#!/usr/bin/env bash
# Start Cloudflare Tunnel using a token from the environment or .env.
# Usage: npm run tunnel  (also started by npm run dev)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  load_token_from_env_file "$ROOT_DIR/.env"
fi

if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: CLOUDFLARE_TUNNEL_TOKEN is not set.

Set it in .env (see .env.example) or export it in the shell:
  CLOUDFLARE_TUNNEL_TOKEN=... npm run tunnel

Get a token from Cloudflare Zero Trust → Networks → Tunnels →
  your tunnel → Configure → Install connector → copy the token
  (cloudflared tunnel run --token ...).

Do not commit the token to git.
EOF
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ERROR: cloudflared is not installed or not on PATH." >&2
  exit 1
fi

# Replace this process so SIGINT/SIGTERM from concurrently stop cloudflared.
exec cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
