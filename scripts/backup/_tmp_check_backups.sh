#!/usr/bin/env bash
set -u
echo "=== server time (UTC) ==="
date -u
echo "=== cron ==="
crontab -l 2>/dev/null | grep -E 'backup-sites|/www/backup.sh' || echo "(none)"
echo "=== site-backup.log (last 60) ==="
tail -60 /var/log/site-backup.log 2>/dev/null || echo "no log"
echo "=== local sites count / newest 20 ==="
find /www/backup/sites -name 'site_*.tar.gz' 2>/dev/null | wc -l
find /www/backup/sites -name 'site_*.tar.gz' -printf '%T+ %s %p\n' 2>/dev/null | sort -r | head -20
echo "=== rclone exclude ==="
cat /www/backup-rclone-exclude.txt 2>/dev/null || echo missing
grep -n 'exclude-from\|rclone copy' /www/backup.sh 2>/dev/null | head -5
echo "=== server-backup.log (last 25) ==="
tail -25 /var/log/server-backup.log 2>/dev/null || echo "no rclone log"
echo "=== Drive day folders (newest) ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>&1 | sort | tail -10
for d in $(rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>/dev/null | sort | tail -3); do
  echo "=== Drive $d sites/ ==="
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${d}sites/" --dirs-only 2>&1 | head -40
  echo "=== sample tars under $d sites (max 15) ==="
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${d}sites/" --max-depth 2 2>&1 | grep 'site_.*\.tar\.gz' | head -15
  echo "=== path/wwwroot under $d (should be empty or absent) ==="
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${d}path/wwwroot/" 2>&1 | head -5
done
echo "CHECK_DONE"
