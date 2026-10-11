#!/usr/bin/env bash
# Install cloudflared-longhua.service (requires root or docker+sudoers update).
set -euo pipefail
UNIT_SRC=/opt/longhuaCRM/deploy/systemd/cloudflared-longhua.service
SUDOERS_SRC=/opt/longhuaCRM/deploy/systemd/longhua-sudoers
install -m 0644 "$UNIT_SRC" /etc/systemd/system/cloudflared-longhua.service
install -m 0440 "$SUDOERS_SRC" /etc/sudoers.d/longhua-crm
visudo -cf /etc/sudoers.d/longhua-crm
systemctl daemon-reload
systemctl enable cloudflared-longhua.service
systemctl restart cloudflared-longhua.service
systemctl status cloudflared-longhua.service --no-pager
