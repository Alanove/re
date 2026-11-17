#!/bin/bash
# Read-only probe part 2 — skip heavy journalctl
set -u
OUT=/tmp/backup-probe2-report.txt
exec >"$OUT" 2>&1

echo "===== HOST / DATE ====="
hostname; date -u; whoami

echo
echo "===== /www/backup.sh (if not already) ====="
ls -la /www/backup.sh 2>/dev/null || echo MISSING
wc -l /www/backup.sh 2>/dev/null
cat /www/backup.sh 2>/dev/null

echo
echo "===== Related scripts ====="
find /www -maxdepth 3 -type f \( -iname '*backup*' -o -iname '*rclone*' \) 2>/dev/null | head -200
ls -la /www/*.sh 2>/dev/null || true
echo "--- /root backup/rclone files ---"
find /root -maxdepth 2 -type f \( -iname '*backup*' -o -iname '*rclone*' -o -name '*.sh' \) 2>/dev/null | head -100
for f in /root/*.sh /www/*.sh; do
  [ -f "$f" ] || continue
  echo "===== FILE $f ====="
  ls -la "$f"
  cat "$f"
done

echo
echo "===== crontabs ====="
echo "--- root ---"
crontab -l -u root 2>&1 || true
echo "--- www ---"
crontab -l -u www 2>&1 || true
echo "--- www-data ---"
crontab -l -u www-data 2>&1 || true
echo "--- litewebchatlb ---"
crontab -l -u litewebchatlb 2>&1 || true

echo
echo "===== /etc/cron grep ====="
grep -RIn -E 'backup|rclone|path_wwwroot|/www/backup' /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly /etc/crontab 2>/dev/null | head -200
ls -la /etc/cron.d 2>/dev/null

echo
echo "===== aaPanel cron ====="
ls -la /www/server/cron 2>/dev/null | head -80
if [ -f /www/server/panel/data/db/crontab.db ]; then
  echo "--- crontab.db ---"
  sqlite3 /www/server/panel/data/db/crontab.db ".tables" 2>/dev/null || true
  sqlite3 /www/server/panel/data/db/crontab.db "SELECT * FROM crontab;" 2>/dev/null | head -200 || true
fi
# also try python dump
python3 - <<'PY' 2>/dev/null || true
import os, sqlite3, json
p='/www/server/panel/data/db/crontab.db'
if os.path.exists(p):
    con=sqlite3.connect(p)
    cur=con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print('tables', cur.fetchall())
    for t in [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]:
        print('TABLE', t)
        try:
            cols=[d[0] for d in cur.execute(f'PRAGMA table_info({t})')]
            print('cols', cols)
            for row in cur.execute(f'SELECT * FROM {t}'):
                print(row)
        except Exception as e:
            print('err', e)
    con.close()
PY

echo
echo "===== path wwwroot listing confirm ====="
ls -lah /www/backup/path/wwwroot/ 2>/dev/null
du -sh /www/backup/path/wwwroot 2>/dev/null
ls -lt /www/backup/path/ 2>/dev/null | head -30
find /www/backup/path -maxdepth 2 -type d 2>/dev/null

echo
echo "===== df ====="
df -h /www / /

echo
echo "===== backup logs (targeted, no journalctl) ====="
ls -la /www/backup/ 2>/dev/null
ls -la /www/backup/backup_restore/ 2>/dev/null
for lf in \
  /www/backup/backup_restore/cron_full_backup.log \
  /www/backup/backup_restore/backup.log \
  /www/backup/backup_restore/backup_task.json \
  /var/log/server-backup.log
do
  [ -e "$lf" ] || continue
  echo "===== LOG/FILE $lf ====="
  ls -la "$lf"
  if [[ "$lf" == *.json ]]; then
    cat "$lf"
  else
    # show last 120 lines and any Aug/Sep/Oct/Nov 2026 errors near end
    tail -n 150 "$lf"
  fi
done

echo
echo "===== journalctl limited (unit/grep with -n) ====="
journalctl -n 200 --no-pager 2>/dev/null | grep -iE 'backup|rclone|path_wwwroot' | tail -50 || true
# aaPanel cron logs often under /www/server/cron
echo "--- /www/server/cron recent files ---"
ls -lt /www/server/cron 2>/dev/null | head -40
# show recent cron script contents that mention backup
for f in /www/server/cron/*; do
  [ -f "$f" ] || continue
  if grep -qiE 'backup|rclone|wwwroot' "$f" 2>/dev/null; then
    echo "===== CRON SCRIPT $f ====="
    ls -la "$f"
    cat "$f"
  fi
done

echo
echo "===== aaPanel backup settings ====="
find /www/server/panel/data -maxdepth 3 \( -iname '*backup*' -o -iname '*cron*' \) 2>/dev/null | head -100
grep -RIn --include='*.json' -E 'path_wwwroot|/www/backup/path|wwwroot|rclone' /www/server/panel/data 2>/dev/null | head -100
# panel config
ls -la /www/server/panel/data/ 2>/dev/null | head -80

echo
echo "===== rclone remotes (read-only, bounded) ====="
command -v rclone
rclone version 2>/dev/null | head -3
rclone listremotes 2>&1
rclone config file 2>&1
echo "--- lsd gdrive:/server-backups/ ---"
timeout 90 rclone lsd gdrive:/server-backups/ 2>&1 | head -80
echo "--- lsl depth1 sorted tail (timeout 120) ---"
timeout 120 rclone lsl gdrive:/server-backups/ --max-depth 1 2>&1 | sort | tail -40
echo "--- lsf recent names ---"
timeout 90 rclone lsf gdrive:/server-backups/ --max-depth 1 2>&1 | sort | tail -40

echo
echo "===== /www/wwwroot names ====="
ls -1 /www/wwwroot 2>/dev/null

echo
echo "===== EXTRA: systemd timers ====="
systemctl list-timers --all 2>/dev/null | grep -iE 'backup|rclone' || true

echo
echo "===== EXTRA: last backup.sh runs / history hints ====="
grep -n '' /var/log/server-backup.log 2>/dev/null | tail -5
# show size of local backups elsewhere
du -sh /www/backup/* 2>/dev/null | head -40

echo
echo "===== DONE ====="
