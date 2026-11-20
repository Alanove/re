#!/usr/bin/env bash
set -u
echo "=== Drive 2026-11-19 sites tar counts ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-19/sites/ --max-depth 2 2>&1 | grep -c 'site_.*\.tar\.gz' || true
rclone size gdrive:/server-backups/ubuntuliteweb/2026-11-19/sites/ 2>&1
echo "=== lebanoninapicture local ==="
ls -lah /www/backup/sites/lebanoninapicture.com/ 2>/dev/null || true
du -sh /www/wwwroot/lebanoninapicture.com /www/wwwroot/lebanoninapicture.com/cache 2>/dev/null || true
echo "=== kill stuck Nov18 backup (lebanoninapicture tar) ==="
# Still the 20261118 run after >36h
pkill -f '/www/backup-sites.sh' || true
pkill -f 'tar -czf /www/backup/sites/lebanoninapicture' || true
sleep 2
pgrep -af 'backup-sites|lebanoninapicture.com.*tar' || echo "cleared"
rm -f /www/backup/sites/lebanoninapicture.com/*.partial
# flock lock is held by dead process; remove lock file if nothing holds it
if ! fuser /var/lock/site-backup.lock >/dev/null 2>&1; then
  rm -f /var/lock/site-backup.lock
  echo "removed stale lock"
else
  echo "lock still held:"; fuser -v /var/lock/site-backup.lock 2>&1 || true
fi
echo "=== remaining sites not yet archived locally (vs wwwroot) ==="
# rough: list wwwroot dirs missing a 20261118 or 20261119 ta
comm -23 \
  <(ls -1 /www/wwwroot | sort) \
  <(ls -1 /www/backup/sites | sort) \
  | head -40
echo "FIX_DONE"
