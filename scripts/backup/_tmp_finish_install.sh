#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_SH=/www/backup.sh
EXCLUDE=/www/backup-rclone-exclude.txt

echo "path/wwwroot/**" > "$EXCLUDE"
chmod 644 "$EXCLUDE"

if grep -q 'backup-rclone-exclude' "$BACKUP_SH"; then
  echo "rclone exclude already in backup.sh"
else
  cp -a "$BACKUP_SH" "${BACKUP_SH}.bak.$(date +%Y%m%d%H%M%S)"
  # Match: rclone copy "$BACKUP_DIR" ...
  sed -i 's|rclone copy "\$BACKUP_DIR" "\$REMOTE/\$TODAY/"|rclone copy "$BACKUP_DIR" "$REMOTE/$TODAY/" --exclude-from /www/backup-rclone-exclude.txt|' "$BACKUP_SH"
  if grep -q 'backup-rclone-exclude' "$BACKUP_SH"; then
    echo "Patched backup.sh OK"
  else
    echo "ERROR: patch failed"; grep -n 'rclone copy' "$BACKUP_SH"; exit 1
  fi
fi

grep -n 'rclone copy' "$BACKUP_SH"

# Dry-run: pick a small CMS site if present
SMALL=""
for cand in thronetrading.com liteweb.info re-petroleum.com zadwbarakat.com; do
  if [[ -d "/www/wwwroot/$cand" ]]; then
    SMALL=$cand
    break
  fi
done
[[ -n "$SMALL" ]] || SMALL=$(ls -1 /www/wwwroot | head -1)

echo "=== dry-run one small site: $SMALL ==="
/www/backup-sites.sh "$SMALL"
ls -lah "/www/backup/sites/$SMALL/"

echo "=== smoke guerrasports ==="
/www/backup-sites.sh guerrasports
ls -lah /www/backup/sites/guerrasports/
# Confirm archive contains public/images and not node_modules
TAR=$(ls -1t /www/backup/sites/guerrasports/site_guerrasports_*.tar.gz | head -1)
echo "TAR=$TAR"
echo -n "sample paths: "
tar -tzf "$TAR" | grep -E 'guerrasports/public/images/|guerrasports/node_modules/' | head -10
echo -n "has images: "
tar -tzf "$TAR" | grep -c 'guerrasports/public/images/' || true
echo -n "has node_modules entries: "
tar -tzf "$TAR" | grep -c 'guerrasports/node_modules/' || true
du -h "$TAR"
echo "=== cron ==="
crontab -l | grep backup-sites
echo "DONE"
