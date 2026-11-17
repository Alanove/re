#!/bin/bash
# Read-only backup investigation probe — do not modify anything
set -u
OUT=/tmp/backup-probe-report.txt
exec >"$OUT" 2>&1

echo "===== HOST / DATE ====="
hostname; date -u; date; whoami; id

echo
echo "===== /www/backup.sh ====="
if [ -f /www/backup.sh ]; then
  ls -la /www/backup.sh
  echo "--- contents ---"
  cat /www/backup.sh
else
  echo "MISSING: /www/backup.sh"
fi

echo
echo "===== Related scripts under /www (backup/rclone) ====="
find /www -maxdepth 3 -type f \( -iname '*backup*' -o -iname '*rclone*' \) 2>/dev/null | head -200
echo "--- /www/*.sh ---"
ls -la /www/*.sh 2>/dev/null || true

echo
echo "===== Related under /root ====="
ls -la /root 2>/dev/null | head -80
find /root -maxdepth 2 -type f \( -iname '*backup*' -o -iname '*rclone*' \) 2>/dev/null | head -100
for f in /root/*.sh /root/backup* /root/*rclone* /root/.bashrc /root/.profile; do
  [ -f "$f" ] || continue
  echo "--- FILE: $f ---"
  ls -la "$f"
  # show if small enough
  sz=$(wc -c <"$f" 2>/dev/null || echo 0)
  if [ "$sz" -lt 50000 ]; then
    cat "$f"
  else
    echo "(large $sz bytes; first 100 lines)"
    head -n 100 "$f"
  fi
done

echo
echo "===== crontab root ====="
crontab -l -u root 2>&1 || true
echo
echo "===== crontab www ====="
crontab -l -u www 2>&1 || true
echo
echo "===== crontab litewebchatlb ====="
crontab -l -u litewebchatlb 2>&1 || true

echo
echo "===== /etc/cron.* backup-related ====="
grep -RIn --include='*' -E 'backup|rclone|path_wwwroot|/www/backup' /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly /etc/crontab 2>/dev/null | head -200
echo "--- listing cron dirs ---"
ls -la /etc/cron.d /etc/cron.daily /etc/cron.hourly 2>/dev/null

echo
echo "===== aaPanel cron if present ====="
ls -la /www/server/cron 2>/dev/null | head -50
ls -la /www/server/panel/data/crontab* 2>/dev/null
find /www/server/panel -maxdepth 3 -iname '*cron*' 2>/dev/null | head -50
# common aaPanel cron DB/files
for p in /www/server/cron /www/server/panel/data /www/server/panel/vhost/cron; do
  [ -d "$p" ] || continue
  echo "--- listing $p ---"
  ls -la "$p" 2>/dev/null | head -80
done
# try dump crontab json/sqlite briefly
if [ -f /www/server/panel/data/db/crontab.db ]; then
  echo "--- crontab.db tables ---"
  sqlite3 /www/server/panel/data/db/crontab.db ".tables" 2>/dev/null || true
  sqlite3 /www/server/panel/data/db/crontab.db "SELECT id,name,type,where1,sName,sBody,status,addtime FROM crontab;" 2>/dev/null | head -100 || true
fi
if [ -f /www/server/panel/data/crontab.json ]; then
  echo "--- crontab.json ---"
  cat /www/server/panel/data/crontab.json
fi

echo
echo "===== /www/backup/path/wwwroot/ listing ====="
BASE=/www/backup/path/wwwroot
if [ -d "$BASE" ]; then
  ls -lah "$BASE" | head -5
  echo "--- newest 30 by mtime ---"
  ls -lt "$BASE" 2>/dev/null | head -35
  echo "--- path_wwwroot_* newest ---"
  ls -lt "$BASE"/path_wwwroot_* 2>/dev/null | head -20
  echo "--- last path_wwwroot date candidates ---"
  ls -1 "$BASE"/path_wwwroot_* 2>/dev/null | sed 's/.*path_wwwroot_//' | sort | tail -20
  echo "--- count ---"
  ls -1 "$BASE"/path_wwwroot_* 2>/dev/null | wc -l
  echo "--- total size ---"
  du -sh "$BASE" 2>/dev/null
else
  echo "MISSING: $BASE"
  echo "--- searching /www/backup ---"
  find /www/backup -maxdepth 4 -type d 2>/dev/null | head -80
  ls -la /www/backup 2>/dev/null
fi

echo
echo "===== df -h /www / ====="
df -h /www / 2>/dev/null
df -h 2>/dev/null | head -30

echo
echo "===== backup / rclone logs ====="
find /www/backup /var/log /tmp -maxdepth 3 -type f \( -iname '*backup*' -o -iname '*rclone*' \) 2>/dev/null | head -80
echo "--- journalctl backup/rclone last 30d (grep) ---"
journalctl --since "2026-08-01" --until "2026-12-01" 2>/dev/null | grep -iE 'backup|rclone|path_wwwroot' | tail -80 || true
echo "--- /www/backup logs dir ---"
ls -la /www/backup/ 2>/dev/null
find /www/backup -name '*.log' 2>/dev/null | head -40
for lf in /www/backup/*.log /www/backup/log/*.log /var/log/rclone* /root/rclone*.log; do
  [ -f "$lf" ] || continue
  echo "--- LOG TAIL: $lf ---"
  ls -la "$lf"
  tail -n 80 "$lf"
done

echo
echo "===== aaPanel path backup settings ====="
find /www/server/panel -maxdepth 4 \( -iname '*backup*' -o -iname '*path*' \) 2>/dev/null | head -100
# config files
for f in /www/server/panel/data/backup* /www/server/panel/class/backup* /www/server/panel/config/backup*; do
  [ -e "$f" ] || continue
  echo "--- $f ---"
  ls -la "$f"
done
# search for path_wwwroot or backup path config
grep -RIn --include='*.json' --include='*.conf' --include='*.pl' --include='*.py' -E 'path_wwwroot|/www/backup/path|wwwroot' /www/server/panel/data /www/server/panel/config 2>/dev/null | head -80

echo
echo "===== rclone remotes (read-only) ====="
which rclone; rclone version 2>/dev/null | head -5
rclone listremotes 2>&1
echo "--- rclone config path ---"
rclone config file 2>&1
echo "--- lsd gdrive:/server-backups/ ---"
rclone lsd gdrive:/server-backups/ 2>&1 | head -50
echo "--- lsl newest under gdrive:/server-backups/ (limited) ---"
rclone lsl gdrive:/server-backups/ --max-depth 2 2>&1 | sort -k2,3 | tail -40

echo
echo "===== /www/wwwroot site folders (names only) ====="
ls -1 /www/wwwroot 2>/dev/null

echo
echo "===== EXTRA: systemd timers related ====="
systemctl list-timers --all 2>/dev/null | grep -iE 'backup|rclone' || true
ls /etc/systemd/system/*backup* /etc/systemd/system/*rclone* 2>/dev/null || true

echo
echo "===== DONE ====="
