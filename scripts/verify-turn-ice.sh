#!/usr/bin/env bash
# Verify coturn + Prosody TURN advertisement (no static frontend creds).
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/longhuaCRM}"
ENV_FILE="${ENV_FILE:-$CRM_DIR/.env.jitsi}"
# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

TURN_HOST="${TURN_HOST:?}"
TURN_PORT="${TURN_PORT:-3478}"
TURN_CREDENTIALS="${TURN_CREDENTIALS:?}"
STUN_HOST="${STUN_HOST:-$TURN_HOST}"
STUN_PORT="${STUN_PORT:-3478}"

echo "== coturn container =="
docker ps --filter name=coturn --format '{{.Names}} {{.Status}}' || true

echo "== listening ports =="
ss -ulnp | grep -E ":${TURN_PORT}\\b" || echo "WARN: UDP ${TURN_PORT} not listening"
ss -tlnp | grep -E ":${TURN_PORT}\\b" || echo "WARN: TCP ${TURN_PORT} not listening"

echo "== Prosody external_services =="
docker exec longhuacrm-prosody-1 sh -c 'grep -n "external_service\|type = \"turn\"\|type = \"stun\"" /config/prosody.cfg.lua | head -40'

echo "== generate time-limited TURN REST credential =="
# draft-uberti-behave-turn-rest-00: username=<expiry>, password=base64(hmac_sha1(secret, username))
EXPIRY=$(( $(date +%s) + 3600 ))
python3 - <<PY
import base64, hashlib, hmac, os
secret = os.environ["TURN_CREDENTIALS"].encode()
user = str(${EXPIRY})
digest = hmac.new(secret, user.encode(), hashlib.sha1).digest()
pwd = base64.b64encode(digest).decode()
print(f"username={user}")
print(f"credential_len={len(pwd)}")
open("/tmp/turn-test.cred","w").write(f"{user}\\n{pwd}\\n")
PY

USER=$(sed -n '1p' /tmp/turn-test.cred)
PASS=$(sed -n '2p' /tmp/turn-test.cred)

echo "== turnutils_uclient allocate (if available) =="
if command -v turnutils_uclient >/dev/null 2>&1; then
  timeout 12 turnutils_uclient -t -u "$USER" -w "$PASS" -y 127.0.0.1 2>&1 | tail -20 || true
else
  echo "turnutils_uclient not installed — using docker coturn client (localhost)"
  timeout 12 docker run --rm --network host coturn/coturn:4.6.2-r12 \
    turnutils_uclient -t -u "$USER" -w "$PASS" -y 127.0.0.1 2>&1 | tail -30 || true
fi

echo "== expected client ICE URLs (via Prosody, not frontend) =="
echo "stun:${STUN_HOST}:${STUN_PORT}"
echo "turn:${TURN_HOST}:${TURN_PORT}?transport=udp  (secret=true, time-limited)"
echo "turn:${TURN_HOST}:${TURN_PORT}?transport=tcp  (secret=true, time-limited)"
echo "OK: config checks done. Live A/V + relay candidate still required for PASS."
