#!/usr/bin/env bash
set -u
echo "===== DATE / HOST ====="
date -Is
hostname
echo
echo "===== df -h ====="
df -h / /www
echo
echo "===== du -sh /www/backup/* ====="
du -sh /www/backup/* 2>/dev/null | sort -hr
echo
echo "===== /www/backup/sites ====="
du -sh /www/backup/sites 2>/dev/null
ls /www/backup/sites 2>/dev/null | wc -l
find /www/backup/sites -name 'site_*.tar.gz' -printf '%TY-%Tm-%Td %TH:%TM %p %s\n' 2>/dev/null | sort -r | head -20
echo
echo "===== newest DB dumps ====="
find /www/backup/database/mysql/crontab_backup -type f \( -name '*.sql.gz' -o -name '*.zip' \) -printf '%T@ %TY-%Tm-%Td %TH:%TM %p %s\n' 2>/dev/null | sort -nr | head -30
echo
echo "===== newest dump per db ====="
for d in /www/backup/database/mysql/crontab_backup/*/; do
  [ -d "$d" ] || continue
  newest=$(ls -1t "$d" 2>/dev/null | head -1)
  if [ -n "$newest" ]; then
    ls -lh --time-style=long-iso "$d$newest" 2>/dev/null
  fi
done
echo
echo "===== DB cron Successful / Failed ====="
grep -E 'Successful|Failed to link|☆backup is complete' /www/server/cron/d7ed380e96c4f82b7ae62fb9bad35545.log 2>/dev/null | tail -50
echo
echo "===== DB cron log tail ====="
tail -60 /www/server/cron/d7ed380e96c4f82b7ae62fb9bad35545.log 2>/dev/null
echo
echo "===== server-backup.log tail ====="
tail -50 /var/log/server-backup.log 2>/dev/null
echo
echo "===== site-backup.log markers ====="
grep -E 'run begin|run complete|ERROR|FAIL ' /var/log/site-backup.log 2>/dev/null | tail -25
echo
echo "===== path/wwwroot ====="
ls -lh /www/backup/path/wwwroot/ 2>/dev/null
echo
echo "===== Drive recent days ====="
rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>&1 | sort | tail -14
echo
echo "===== Drive monolith / sites sample ====="
for d in $(rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>/dev/null | sort | tail -5); do
  day="${d%/}"
  echo "--- $day ---"
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${day}/path/wwwroot/" 2>&1 | head -5
  echo "sites tar count:"
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${day}/sites/" --max-depth 2 2>&1 | grep -c 'site_.*\.tar\.gz' || true
  echo "database sample:"
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/${day}/database/" --max-depth 1 2>&1 | head -10
done
echo
echo "CHECK_LIVE_DONE"
