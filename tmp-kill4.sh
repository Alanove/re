#!/bin/bash
KEY="/c/Users/ahaddad/.ssh/id_ed25519"
HOST="litewebchatlb@ubuntu.liteweb.info"
ssh -i "$KEY" -o BatchMode=yes "$HOST" \
  'sudo pkill -f /tmp/backup-probe4.sh 2>/dev/null; sudo pkill -f "du -sh /www/wwwroot" 2>/dev/null; echo killed'
scp -i "$KEY" -o BatchMode=yes "$HOST:/tmp/backup-probe4-report.txt" /c/ai/tests/re/tmp-backup-probe4-report.txt || true
