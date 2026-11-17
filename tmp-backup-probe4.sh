#!/bin/bash
# Final tiny read-only checks
set -u
OUT=/tmp/backup-probe4-report.txt
exec >"$OUT" 2>&1

python3 - <<'PY'
import sqlite3
p='/www/server/panel/data/default.db'
con=sqlite3.connect(f'file:{p}?mode=ro', uri=True)
cur=con.cursor()
cols=[d[1] for d in cur.execute('PRAGMA table_info(crontab)')]
print('COLS', cols)
print('--- all crontab rows (key fields) ---')
for row in cur.execute("SELECT id,name,type,where_hour,where_minute,echo,status,save,backupTo,sName,sType,save_local,addtime,result FROM crontab"):
    print(row)
print('--- backup table last path_wwwroot ---')
try:
    cols=[d[1] for d in cur.execute('PRAGMA table_info(backup)')]
    print('backup cols', cols)
    for row in cur.execute("SELECT * FROM backup WHERE name LIKE '%wwwroot%' OR filename LIKE '%wwwroot%' OR ps LIKE '%wwwroot%' ORDER BY id DESC LIMIT 20"):
        print(row)
except Exception as e:
    print('backup table err', e)
    for t in [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]:
        if 'back' in t.lower():
            print('table', t)
            cols=[d[1] for d in cur.execute(f'PRAGMA table_info({t})')]
            print(cols)
            for row in cur.execute(f'SELECT * FROM {t} ORDER BY rowid DESC LIMIT 15'):
                print(row)
con.close()
PY

echo
echo "===== gdrive path/wwwroot under recent days ====="
for d in 2026-11-17 2026-11-16 2026-08-23 2026-08-22 2026-08-24; do
  echo "--- $d/path ---"
  rclone lsf "gdrive:/server-backups/ubuntuliteweb/$d/path/" --max-depth 2 2>&1 | head -20
done

echo
echo "===== local path/wwwroot via rclone today ====="
rclone lsf gdrive:/server-backups/ubuntuliteweb/2026-11-17/path/wwwroot/ 2>&1 | head -20
rclone size gdrive:/server-backups/ubuntuliteweb/2026-11-17/path/wwwroot/ 2>&1

echo
echo "===== du wwwroot (for per-site planning) ====="
du -sh /www/wwwroot/* 2>/dev/null | sort -hr | head -40
df -h / /

echo
echo "===== DONE ====="
