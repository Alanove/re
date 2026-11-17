#!/bin/bash
set -euo pipefail
KEY="/c/Users/ahaddad/.ssh/id_ed25519"
HOST="litewebchatlb@ubuntu.liteweb.info"
sed -i 's/\r$//' /c/ai/tests/re/tmp-backup-probe4.sh
scp -i "$KEY" -o BatchMode=yes /c/ai/tests/re/tmp-backup-probe4.sh "$HOST:/tmp/backup-probe4.sh"
ssh -i "$KEY" -o BatchMode=yes "$HOST" 'sudo bash /tmp/backup-probe4.sh; echo EXIT:$?; wc -c /tmp/backup-probe4-report.txt'
scp -i "$KEY" -o BatchMode=yes "$HOST:/tmp/backup-probe4-report.txt" /c/ai/tests/re/tmp-backup-probe4-report.txt
echo ALL_DONE
