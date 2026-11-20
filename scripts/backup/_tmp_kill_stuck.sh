#!/usr/bin/env bash
set -u
pkill -f '/www/backup-sites.sh' || true
pkill -f 'tar -czf /www/backup/sites/lebanoninapicture' || true
sleep 2
pgrep -af 'backup-sites|lebanoninapicture.com.*\.partial' || echo "no backup process"
rm -f /www/backup/sites/lebanoninapicture.com/*.partial
if ! fuser /var/lock/site-backup.lock >/dev/null 2>&1; then
  rm -f /var/lock/site-backup.lock
  echo "removed stale lock"
else
  fuser -v /var/lock/site-backup.lock 2>&1 || true
fi
ls -lah /www/backup/sites/lebanoninapicture.com/ 2>/dev/null || echo "dir empty/gone"
echo "KILL_DONE"
