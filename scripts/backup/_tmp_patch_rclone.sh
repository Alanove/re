#!/usr/bin/env bash
set -Eeuo pipefail
BACKUP_SH=/www/backup.sh
EXCLUDE=/www/backup-rclone-exclude.txt
[[ -f "$BACKUP_SH" ]] || { echo "missing $BACKUP_SH"; exit 1; }
echo "=== current backup.sh (rclone lines) ==="
grep -n -i rclone "$BACKUP_SH" || true
echo "=== head ==="
head -80 "$BACKUP_SH"
echo "EXCLUDE file:"
cat "$EXCLUDE"
