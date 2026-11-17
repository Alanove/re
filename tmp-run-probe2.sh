#!/bin/bash
set -euo pipefail
KEY="/c/Users/ahaddad/.ssh/id_ed25519"
HOST="litewebchatlb@ubuntu.liteweb.info"
sed -i 's/\r$//' /c/ai/tests/re/tmp-backup-probe2.sh
scp -i "$KEY" -o BatchMode=yes /c/ai/tests/re/tmp-backup-probe2.sh "$HOST:/tmp/backup-probe2.sh"
ssh -i "$KEY" -o BatchMode=yes "$HOST" \
  'chmod +x /tmp/backup-probe2.sh && sudo bash /tmp/backup-probe2.sh; echo EXIT:$?; ls -la /tmp/backup-probe2-report.txt; wc -c /tmp/backup-probe2-report.txt'
scp -i "$KEY" -o BatchMode=yes "$HOST:/tmp/backup-probe2-report.txt" /c/ai/tests/re/tmp-backup-probe2-report.txt
echo ALL_DONE
