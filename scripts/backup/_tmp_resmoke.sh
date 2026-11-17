#!/usr/bin/env bash
set -Eeuo pipefail
sed -i 's/\r$//' /tmp/backup-sites.sh
install -m 755 /tmp/backup-sites.sh /www/backup-sites.sh
echo "=== re-smoke guerrasports with fixed excludes ==="
/www/backup-sites.sh guerrasports
TAR=$(ls -1t /www/backup/sites/guerrasports/site_guerrasports_*.tar.gz | head -1)
echo "TAR=$TAR"
du -h "$TAR"
set +e
IMG=$(tar -tzf "$TAR" | grep -c 'guerrasports/public/images/' || true)
NM=$(tar -tzf "$TAR" | grep -c 'guerrasports/node_modules/' || true)
DIST=$(tar -tzf "$TAR" | grep -c 'guerrasports/dist/' || true)
LOGS=$(tar -tzf "$TAR" | grep -c 'guerrasports/logs/' || true)
set -e
echo "images_entries=$IMG node_modules_entries=$NM dist_entries=$DIST logs_entries=$LOGS"
if [[ "$NM" != "0" || "$DIST" != "0" || "$LOGS" != "0" ]]; then
  echo "ERROR: excludes still leaking"
  exit 1
fi
if [[ "$IMG" -lt 1 ]]; then
  echo "ERROR: no images in archive"
  exit 1
fi
ls -lah /www/backup/sites/guerrasports/
echo "RESMOKE_OK"
