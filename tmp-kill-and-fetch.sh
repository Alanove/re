#!/bin/bash
KEY="/c/Users/ahaddad/.ssh/id_ed25519"
HOST="litewebchatlb@ubuntu.liteweb.info"
# Kill hung journalctl/grep under the probe (read-only investigation cleanup of our own probe)
ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" \
  'sudo pkill -f "/tmp/backup-probe.sh" 2>/dev/null; sudo pkill -f "journalctl --since 2026-08-01" 2>/dev/null; sleep 1; ls -la /tmp/backup-probe-report.txt; wc -c /tmp/backup-probe-report.txt'
scp -i "$KEY" -o BatchMode=yes "$HOST:/tmp/backup-probe-report.txt" /c/ai/tests/re/tmp-backup-probe-report.txt
echo FETCH_DONE
