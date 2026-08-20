#!/usr/bin/env bash
# Install / update LonghuaCRM systemd autostart (runtime only, not deploy).
# Requires root (sudo).
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/longhuaCRM}"
UNIT_SRC="${CRM_DIR}/deploy/systemd/longhua.service"
SUDOERS_SRC="${CRM_DIR}/deploy/systemd/longhua-sudoers"
UNIT_DST="/etc/systemd/system/longhua.service"
SUDOERS_DST="/etc/sudoers.d/longhua-crm"
RUNTIME="${CRM_DIR}/scripts/longhua-screen-runtime.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Missing unit source: $UNIT_SRC" >&2
  exit 1
fi
if [[ ! -x "$RUNTIME" ]]; then
  chmod +x "$RUNTIME"
fi

install -m 0644 "$UNIT_SRC" "$UNIT_DST"
install -m 0440 "$SUDOERS_SRC" "$SUDOERS_DST"
if ! visudo -cf "$SUDOERS_DST" >/dev/null; then
  echo "Invalid sudoers file — removing $SUDOERS_DST" >&2
  rm -f "$SUDOERS_DST"
  exit 1
fi

systemctl daemon-reload
systemctl enable longhua.service
systemctl restart longhua.service

echo "Installed: $UNIT_DST"
echo "Enabled + restarted longhua.service"
systemctl --no-pager --full status longhua.service || true
