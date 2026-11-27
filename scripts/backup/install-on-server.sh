#!/usr/bin/env bash
# Run ON the server as root after scp'ing scripts into /tmp (or pass paths).
#   sudo bash /tmp/install-on-server.sh
# Optional args: [backup-sites.sh path] [backup.sh path]
set -Eeuo pipefail

SITES_SRC="${1:-/tmp/backup-sites.sh}"
BACKUP_SRC="${2:-/tmp/backup.sh}"
SITES_DEST=/www/backup-sites.sh
BACKUP_DEST=/www/backup.sh
CRON_LINE='15 2 * * * /www/backup-sites.sh >> /var/log/site-backup.log 2>&1'
EXCLUDE_FILTER=/www/backup-rclone-exclude.txt

[[ "$(id -u)" -eq 0 ]] || { echo "Must run as root"; exit 1; }
[[ -f "$SITES_SRC" ]] || { echo "Missing $SITES_SRC"; exit 1; }
[[ -f "$BACKUP_SRC" ]] || { echo "Missing $BACKUP_SRC"; exit 1; }

install -m 755 "$SITES_SRC" "$SITES_DEST"
if [[ -f "$BACKUP_DEST" ]]; then
  cp -a "$BACKUP_DEST" "${BACKUP_DEST}.bak.$(date +%Y%m%d%H%M%S)"
fi
install -m 755 "$BACKUP_SRC" "$BACKUP_DEST"
touch /var/log/site-backup.log /var/log/server-backup.log
mkdir -p /www/backup/sites /www/backup/database /www/backup/path /var/lock

# Exclude stale monolithic path_wwwroot tars from nightly rclone.
cat > "$EXCLUDE_FILTER" <<'EOF'
path/wwwroot/**
EOF
chmod 644 "$EXCLUDE_FILTER"

# Install site-backup cron if missing.
if crontab -l 2>/dev/null | grep -qF '/www/backup-sites.sh'; then
  echo "Cron already has backup-sites.sh"
else
  (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
  echo "Installed cron: $CRON_LINE"
fi

echo "Installed $SITES_DEST and $BACKUP_DEST"
ls -la "$SITES_DEST" "$BACKUP_DEST" "$EXCLUDE_FILTER"
crontab -l | grep backup-sites || true
grep -n 'clear_local_after_upload\|LOCAL_CLEAR_TREES\|exclude-from' "$BACKUP_DEST" | head -10
