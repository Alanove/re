#!/bin/bash
KEY="/c/Users/ahaddad/.ssh/id_ed25519"
HOST="litewebchatlb@ubuntu.liteweb.info"
ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=15 "$HOST" \
  'ps aux | grep -E "[b]ackup-probe4|[d]u -sh /www/wwwroot|[r]clone" | head -20; echo ---; ls -la /tmp/backup-probe4-report.txt 2>/dev/null; wc -c /tmp/backup-probe4-report.txt 2>/dev/null; echo ---TAIL---; tail -n 50 /tmp/backup-probe4-report.txt 2>/dev/null'
