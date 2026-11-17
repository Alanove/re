#!/bin/bash
set -euo pipefail
KEY="${USERPROFILE//\\//}/.ssh/id_ed25519"
# Git bash style path
if [ ! -f "$KEY" ]; then
  KEY="/c/Users/ahaddad/.ssh/id_ed25519"
fi
HOST="litewebchatlb@ubuntu.liteweb.info"
scp -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  /c/ai/tests/re/tmp-backup-probe.sh "$HOST:/tmp/backup-probe.sh"
ssh -i "$KEY" -o BatchMode=yes "$HOST" \
  'chmod +x /tmp/backup-probe.sh && sudo bash /tmp/backup-probe.sh; echo EXIT:$?; ls -la /tmp/backup-probe-report.txt; wc -c /tmp/backup-probe-report.txt'
