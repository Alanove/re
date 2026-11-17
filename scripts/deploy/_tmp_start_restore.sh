#!/usr/bin/env bash
set -euo pipefail
pkill -f restore_guerra || true
pkill -f path_wwwroot_20260823 || true
sleep 1
head -3 /tmp/restore_guerra_v2.sh
cp /tmp/restore_guerra_v2.sh /www/deploy/tmp/restore_guerra_v2.sh
chmod +x /www/deploy/tmp/restore_guerra_v2.sh
: > /www/deploy/tmp/guerra-images-restore.log
nohup bash /www/deploy/tmp/restore_guerra_v2.sh >/dev/null 2>&1 &
echo "STARTED_PID=$!"
sleep 2
head -20 /www/deploy/tmp/guerra-images-restore.log
