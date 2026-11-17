#!/usr/bin/env bash
# Run ON the server as root after scp'ing this folder's scripts.
#   sudo bash /tmp/install-site-backups.sh
set -Eeuo pipefail

SRC="${1:-/tmp/backup-sites.sh}"
DEST=/www/backup-sites.sh
CRON_LINE='15 2 * * * /www/backup-sites.sh >> /var/log/site-backup.log 2>&1'
BACKUP_SH=/www/backup.sh
EXCLUDE_FILTER=/www/backup-rclone-exclude.txt

[[ "$(id -u)" -eq 0 ]] || { echo "Must run as root"; exit 1; }
[[ -f "$SRC" ]] || { echo "Missing $SRC"; exit 1; }

install -m 755 "$SRC" "$DEST"
touch /var/log/site-backup.log
mkdir -p /www/backup/sites /var/lock

# Exclude stale monolithic path_wwwroot tars from nightly rclone (keep files on disk).
cat > "$EXCLUDE_FILTER" <<'EOF'
path/wwwroot/**
EOF
chmod 644 "$EXCLUDE_FILTER"

if [[ -f "$BACKUP_SH" ]]; then
  if grep -q 'backup-rclone-exclude' "$BACKUP_SH"; then
    echo "rclone exclude already wired in $BACKUP_SH"
  elif grep -q 'rclone copy "$BACKUP_DIR"' "$BACKUP_SH"; then
    cp -a "$BACKUP_SH" "${BACKUP_SH}.bak.$(date +%Y%m%d%H%M%S)"
    sed -i 's|rclone copy "\$BACKUP_DIR" "\$REMOTE/\$TODAY/"|rclone copy "$BACKUP_DIR" "$REMOTE/$TODAY/" --exclude-from /www/backup-rclone-exclude.txt|' "$BACKUP_SH"
    if grep -q 'backup-rclone-exclude' "$BACKUP_SH"; then
      echo "Patched $BACKUP_SH to use $EXCLUDE_FILTER"
    else
      echo "WARNING: patch of $BACKUP_SH did not stick; add --exclude-from $EXCLUDE_FILTER manually"
    fi
  else
    echo "WARNING: could not find rclone copy \"\$BACKUP_DIR\" in $BACKUP_SH; add --exclude-from $EXCLUDE_FILTER manually"
  fi
else
  echo "WARNING: $BACKUP_SH missing; skip rclone exclude patch"
fi

# Install cron if missing.
if crontab -l 2>/dev/null | grep -qF '/www/backup-sites.sh'; then
  echo "Cron already has backup-sites.sh"
else
  (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
  echo "Installed cron: $CRON_LINE"
fi

echo "Installed $DEST"
ls -la "$DEST" "$EXCLUDE_FILTER"
crontab -l | grep backup-sites || true
