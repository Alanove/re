#!/usr/bin/env bash
# One-shot: copy remaining /www/backup trees to today's Drive folder, verify, then delete local files.
set -Eeuo pipefail

TODAY="$(date +%Y-%m-%d)"
REMOTE="gdrive:/server-backups/$(hostname)/${TODAY}"
EXCLUDE=/www/backup-rclone-exclude.txt
LOG=/var/log/server-backup-cleanup-now.log

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

[[ "$(id -u)" -eq 0 ]] || { echo "Must run as root"; exit 1; }

log "=== emergency upload+cleanup begin (remote=$REMOTE) ==="
df -h / | tee -a "$LOG"

RCLONE_OPTS=(--stats-one-line -P --exclude '*.partial')
if [[ -f "$EXCLUDE" ]]; then
  RCLONE_OPTS+=(--exclude-from "$EXCLUDE")
fi

# Copy trees we intend to clear locally (path/wwwroot already empty / excluded).
for tree in database sites file_history nodejs backup_restore; do
  src="/www/backup/$tree"
  [[ -d "$src" ]] || { log "SKIP missing $src"; continue; }
  log "COPY $src -> ${REMOTE}/${tree}/"
  if rclone copy "$src" "${REMOTE}/${tree}/" "${RCLONE_OPTS[@]}"; then
    log "OK copy $tree"
  else
    log "FAIL copy $tree — aborting, no deletes"
    exit 1
  fi
done

log "VERIFY remote sizes"
rclone size "${REMOTE}/database/" 2>&1 | tee -a "$LOG"
rclone size "${REMOTE}/sites/" 2>&1 | tee -a "$LOG"
REMOTE_COUNT=$(rclone size "$REMOTE/" --json | grep -o '"count":[0-9]*' | cut -d':' -f2)
log "Remote file count under $TODAY: ${REMOTE_COUNT:-0}"
if [[ -z "${REMOTE_COUNT:-}" || "$REMOTE_COUNT" -eq 0 ]]; then
  log "FAIL empty remote — aborting deletes"
  exit 1
fi

log "CHECK sites via rclone check (completed files only)"
: > /tmp/missing-sites.txt
set +e
rclone check /www/backup/sites "${REMOTE}/sites/" --one-way --size-only \
  --exclude '*.partial' --differ /dev/null --missing-on-dst /tmp/missing-sites.txt 2>&1 | tee -a "$LOG"
set -e
if [[ -s /tmp/missing-sites.txt ]]; then
  log "FAIL missing on Drive:"
  cat /tmp/missing-sites.txt | tee -a "$LOG"
  exit 1
fi
log "OK sites check (no missing completed files)"

log "CHECK database via rclone check"
: > /tmp/missing-db.txt
set +e
rclone check /www/backup/database "${REMOTE}/database/" --one-way --size-only \
  --differ /dev/null --missing-on-dst /tmp/missing-db.txt 2>&1 | tee -a "$LOG"
set -e
if [[ -s /tmp/missing-db.txt ]]; then
  log "FAIL missing DB files on Drive:"
  cat /tmp/missing-db.txt | tee -a "$LOG"
  exit 1
fi
log "OK database check (no missing-on-dst)"

log "DELETE local backup files (keep directories and *.partial)"
for tree in sites database path file_history nodejs backup_restore; do
  dir="/www/backup/$tree"
  [[ -d "$dir" ]] || continue
  before=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
  find "$dir" -type f ! -name '*.partial' -delete
  find "$dir" -mindepth 1 -type d -empty -delete 2>/dev/null || true
  mkdir -p "$dir"
  log "CLEARED $dir (was $before; *.partial kept)"
done

log "=== done ==="
df -h / | tee -a "$LOG"
du -sh /www/backup/* 2>/dev/null | tee -a "$LOG" || true
log "CLEANUP_NOW_DONE"
