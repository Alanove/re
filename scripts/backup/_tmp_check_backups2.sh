#!/usr/bin/env bash
set -u
echo "=== lock / running process ==="
ls -la /var/lock/site-backup.lock 2>/dev/null || echo "no lock file"
fuser /var/lock/site-backup.lock 2>/dev/null || true
pgrep -af 'backup-sites|tar -czf' || echo "no backup-sites/tar process"
echo "=== log end / complete markers ==="
grep -E 'run begin|run complete|ERROR|FAIL ' /var/log/site-backup.log | tail -40
echo "=== site folders with tars ==="
ls /www/backup/sites | wc -l
ls /www/backup/sites
echo "=== nov19 rclone failure context ==="
grep -n '2026-11-19\|ERROR\|Successfully\|Copying' /var/log/server-backup.log | tail -40
echo "=== Drive days ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>&1 | sort | tail -12
echo "=== Drive 2026-11-18 sites ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-18/sites/ --dirs-only 2>&1 | head -50
rclone size gdrive:/server-backups/ubuntuliteweb/2026-11-18/sites/ 2>&1
echo "=== Drive 2026-11-19 ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-19/ 2>&1 | head -30
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-19/sites/ --dirs-only 2>&1 | head -40
echo "=== Drive 2026-11-17 path wwwroot sample ==="
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-17/path/wwwroot/ 2>&1 | head -5
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-18/path/wwwroot/ 2>&1 | head -5
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-19/path/wwwroot/ 2>&1 | head -5
echo "CHECK2_DONE"
