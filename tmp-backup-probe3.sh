#!/bin/bash
# Read-only focused follow-up
set -u
OUT=/tmp/backup-probe3-report.txt
exec >"$OUT" 2>&1

echo "===== ALL aaPanel cron script bodies ====="
for f in /www/server/cron/*; do
  [ -f "$f" ] || continue
  case "$f" in *.log) continue ;; esac
  echo "===== SCRIPT $f ====="
  ls -la "$f"
  cat "$f"
  echo
done

echo
echo "===== root crontab.bak ====="
ls -la /root/crontab.bak* 2>/dev/null
cat /root/crontab.bak.20261109-232112 2>/dev/null

echo
echo "===== crontab from default.db / crontab.db ====="
ls -la /www/server/panel/data/db/ 2>/dev/null
python3 - <<'PY'
import os, sqlite3
for p in [
  '/www/server/panel/data/db/crontab.db',
  '/www/server/panel/data/default.db',
  '/www/server/panel/data/db/default.db',
]:
  if not os.path.exists(p):
    print('missing', p); continue
  print('===', p, 'size', os.path.getsize(p))
  con=sqlite3.connect(f'file:{p}?mode=ro', uri=True)
  cur=con.cursor()
  tables=[r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
  print('tables', tables)
  for t in tables:
    if 'cron' in t.lower() or t.lower()=='crontab' or 'backup' in t.lower():
      cols=[d[1] for d in cur.execute(f'PRAGMA table_info({t})')]
      print('TABLE', t, 'COLS', cols)
      try:
        for row in cur.execute(f'SELECT * FROM {t}'):
          print(row)
      except Exception as e:
        print('err', e)
  # also dump any table named crontab even if missed
  con.close()
PY

# aaPanel often stores crontab in default.db table crontab
python3 - <<'PY'
import os, sqlite3, json
p='/www/server/panel/data/default.db'
con=sqlite3.connect(f'file:{p}?mode=ro', uri=True)
cur=con.cursor()
tables=[r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print('default.db tables:', tables)
for t in tables:
  if 'cron' in t.lower():
    cols=[d[1] for d in cur.execute(f'PRAGMA table_info({t})')]
    print('CRON TABLE', t, cols)
    for row in cur.execute(f'SELECT * FROM {t}'):
      print(row)
con.close()
PY

echo
echo "===== tail server-backup.log ====="
ls -la /var/log/server-backup.log
tail -n 120 /var/log/server-backup.log

echo
echo "===== path-related cron logs (tails + errors) ====="
for id in 2c8c8f84b5ebec5dc5f82253108ef69f b4172d9e4ce13014fc515569f6cf3138 b6398158cd6176b83fe5557e37f70dde d7ed380e96c4f82b7ae62fb9bad35545 4984195e1286dbbbf90bb77a83eb7db8; do
  lf="/www/server/cron/${id}.log"
  echo "===== LOG $lf ====="
  ls -la "$lf" 2>/dev/null || { echo missing; continue; }
  echo "--- head ---"
  head -n 40 "$lf"
  echo "--- tail ---"
  tail -n 80 "$lf"
  echo "--- error grep ---"
  grep -iE 'error|fail|no space|disk|path_wwwroot|backup|成功|失败|Space' "$lf" 2>/dev/null | tail -n 40
done

echo
echo "===== backup_task.json + restore logs tails ====="
cat /www/backup/backup_restore/backup_task.json 2>/dev/null
echo
tail -n 60 /www/backup/backup_restore/cron_full_backup.log 2>/dev/null
echo
tail -n 60 /www/backup/backup_restore/backup.log 2>/dev/null

echo
echo "===== panel config crontab.json ====="
cat /www/server/panel/config/crontab.json 2>/dev/null | head -c 20000

echo
echo "===== rclone remotes detail (lsd only) ====="
rclone listremotes
rclone lsd gdrive:/server-backups/ 2>&1
rclone lsd gdrive:/server-backups/ubuntuliteweb/ 2>&1 | tail -40
echo "--- recent dated folders ---"
rclone lsf gdrive:/server-backups/ubuntuliteweb/ --dirs-only 2>&1 | sort | tail -30
echo "--- sample today path listing ---"
rclone lsf "gdrive:/server-backups/ubuntuliteweb/$(date +%Y-%m-%d)/" --max-depth 2 2>&1 | head -50
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-08-23/ --max-depth 2 2>&1 | head -40
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-08-24/ --max-depth 2 2>&1 | head -40

echo
echo "===== which cron scripts mention path/wwwroot/backup.py ====="
grep -nH '' /www/server/cron/* 2>/dev/null | grep -v '\.log:' | head -200
grep -l 'backup\|wwwroot\|rclone\|path' /www/server/cron/* 2>/dev/null | grep -v '\.log$'

echo
echo "===== site backup dir ====="
ls -la /www/backup/site 2>/dev/null | head -30
du -sh /www/backup/site /www/backup/path /www/backup/database /www/backup/nodejs 2>/dev/null

echo
echo "===== DONE ====="
