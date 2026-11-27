#!/bin/bash
# Enhanced Server Backup Script
# Purpose: Copy /www/backup to Google Drive, then free local copies.
# Retention on Drive: 7 daily + 4 weekly + unlimited monthly backups.
# Local files under /www/backup/{sites,database,path,file_history,nodejs,backup_restore}
# are deleted only after a successful, verified rclone copy.
# NOTE: This script must be run as ROOT
# Repo copy: scripts/backup/backup.sh — install to /www/backup.sh

set -o errexit
set -o pipefail

# Constants
LOG_FILE="/var/log/server-backup.log"
LOCK_FILE="/var/run/server-backup.lock"
HOSTNAME=$(hostname)
BACKUP_DIR="/www/backup"
REMOTE="gdrive:/server-backups/$HOSTNAME"
DATE_FORMAT="%Y-%m-%d"
TODAY=$(date +${DATE_FORMAT})
EXCLUDE_FILTER="/www/backup-rclone-exclude.txt"
# Local trees cleared after a verified offsite copy. Live sites stay in /www/wwwroot.
LOCAL_CLEAR_TREES=(sites database path file_history nodejs backup_restore)

# Retention policy settings
DAILY_RETENTION_DAYS=7      # Keep all backups for last 7 days
WEEKLY_RETENTION_WEEKS=4    # Keep 4 weekly backups after daily period
# Monthly backups are kept indefinitely

# Function to log messages
log() {
  local message="$1"
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[${timestamp}] ${message}" | tee -a "$LOG_FILE"
}

# Function for cleanup on exit
cleanup() {
  log "Cleaning up and removing lock file"
  rm -f "$LOCK_FILE"

  # Report execution time
  END_TIME=$(date +%s)
  RUNTIME=$((END_TIME - START_TIME))
  log "Backup process completed in ${RUNTIME} seconds"
}

# Function to handle errors
error_handler() {
  local exit_code=$?
  local line_no=$1
  log "ERROR: Script failed with exit code $exit_code at line $line_no"
  cleanup
  exit $exit_code
}

clear_local_after_upload() {
  local tree dir before
  log "Clearing local backup files after verified Drive copy"
  for tree in "${LOCAL_CLEAR_TREES[@]}"; do
    dir="${BACKUP_DIR}/${tree}"
    if [[ ! -d "$dir" ]]; then
      log "  skip missing $dir"
      continue
    fi
    before=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
    # Leave in-progress *.partial archives for the running backup-sites job.
    find "$dir" -type f ! -name '*.partial' -delete
    find "$dir" -mindepth 1 -type d -empty -delete 2>/dev/null || true
    mkdir -p "$dir"
    log "  cleared $dir (was ${before:-unknown}; *.partial kept)"
  done
}

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root"
  echo "Please run with: sudo $0"
  exit 1
fi

# Set up trap for error handling and cleanup
trap 'error_handler ${LINENO}' ERR
trap cleanup EXIT

# Check if script is already running
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  if ps -p "$LOCK_PID" > /dev/null 2>&1; then
    log "ERROR: Backup already running with PID $LOCK_PID"
    exit 1
  else
    log "WARNING: Found stale lock file. Previous backup may have failed."
    rm -f "$LOCK_FILE"
  fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Record start time
START_TIME=$(date +%s)
log "Starting backup process (running as root)"

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  log "ERROR: Backup directory '$BACKUP_DIR' does not exist"
  exit 1
fi

# Check if backup directory has content
if [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
  log "WARNING: Backup directory '$BACKUP_DIR' is empty"
  # Continue anyway as this might be intentional
fi

# Verify rclone is installed and configured
if ! command -v rclone &> /dev/null; then
  log "ERROR: rclone command not found"
  exit 1
fi

# Test rclone access to the remote
log "Testing access to remote storage"
if ! rclone lsf "$REMOTE" &> /dev/null; then
  log "ERROR: Cannot access remote storage. Check rclone configuration for root user."
  log "Run 'rclone config' as root to configure Google Drive access"
  exit 1
fi

# Perform the backup
log "Copying backup to ${REMOTE}/${TODAY}/"
# Skip in-progress site tars (*.partial) written by backup-sites.sh.
RCLONE_COPY=(rclone copy "$BACKUP_DIR" "$REMOTE/$TODAY/" --stats-one-line -P --exclude '*.partial')
if [[ -f "$EXCLUDE_FILTER" ]]; then
  RCLONE_COPY+=(--exclude-from "$EXCLUDE_FILTER")
  log "Using exclude filter $EXCLUDE_FILTER"
fi
if "${RCLONE_COPY[@]}"; then
  log "Backup completed successfully"
else
  log "ERROR: Backup failed — local copies kept"
  exit 1
fi

# Verify the backup (check files were copied)
log "Verifying backup integrity"
REMOTE_FILE_COUNT=$(rclone size "$REMOTE/$TODAY/" --json | grep -o '"count":[0-9]*' | cut -d':' -f2)
if [ -z "$REMOTE_FILE_COUNT" ] || [ "$REMOTE_FILE_COUNT" -eq 0 ]; then
  log "ERROR: No files on remote for $TODAY. Local copies kept."
  exit 1
fi
log "Successfully copied $REMOTE_FILE_COUNT files to remote storage"

# Confirm no local files are missing on the remote (size-only, one-way).
# Skip empty trees. Fail closed: any missing-on-dst aborts local delete.
MISSING_ANY=0
for tree in "${LOCAL_CLEAR_TREES[@]}"; do
  src="${BACKUP_DIR}/${tree}"
  [[ -d "$src" ]] || continue
  if [[ -z "$(find "$src" -type f -print -quit)" ]]; then
    continue
  fi
  log "Checking ${tree}/ against remote"
  tree_missing=$(mktemp)
  set +e
  rclone check "$src" "$REMOTE/$TODAY/${tree}/" --one-way --size-only \
    --exclude '*.partial' \
    --differ /dev/null --missing-on-dst "$tree_missing" 2>&1 | tee -a "$LOG_FILE"
  set -e
  if [[ -s "$tree_missing" ]]; then
    log "ERROR: files missing on Drive under ${tree}/ — local copies kept"
    cat "$tree_missing" | tee -a "$LOG_FILE"
    MISSING_ANY=1
  fi
  rm -f "$tree_missing"
done

if [[ "$MISSING_ANY" -ne 0 ]]; then
  exit 1
fi

clear_local_after_upload

# Calculate retention dates using more portable date formats
get_date_days_ago() {
  if date -d "today" &>/dev/null 2>&1; then
    # GNU date
    date -d "-$1 days" +${DATE_FORMAT}
  else
    # BSD date (macOS)
    date -v-"$1"d +${DATE_FORMAT}
  fi
}

# Calculate cutoff dates
DAILY_CUTOFF=$(get_date_days_ago $DAILY_RETENTION_DAYS)
WEEKLY_CUTOFF=$(get_date_days_ago $((DAILY_RETENTION_DAYS + (WEEKLY_RETENTION_WEEKS * 7))))

log "Retention policy:"
log "  - Daily: Keep all backups from last $DAILY_RETENTION_DAYS days (after $DAILY_CUTOFF)"
log "  - Weekly: Keep $WEEKLY_RETENTION_WEEKS weekly backups (after $WEEKLY_CUTOFF)"
log "  - Monthly: Keep one backup per month indefinitely"

# List all remote backup folders
log "Retrieving list of existing backups"
BACKUP_DATES=$(rclone lsf "$REMOTE" --dirs-only | grep -Eo '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort)

if [ -z "$BACKUP_DATES" ]; then
  log "No existing backups found to clean up"
  log "Backup process completed successfully"
  exit 0
fi

# Identify backups to retain
declare -A WEEKLY_BACKUPS
declare -A MONTHLY_BACKUPS

log "Identifying weekly and monthly backups to retain"

# Process each backup date
for d in $BACKUP_DATES; do
  # Get week number and month for this backup
  if date -d "$d" &>/dev/null 2>&1; then
    # GNU date
    WEEK=$(date -d "$d" +%Y-W%U)  # Year-Week format
    MONTH=$(date -d "$d" +%Y-%m)   # Year-Month format
  else
    # BSD date (macOS)
    WEEK=$(date -j -f %Y-%m-%d "$d" +%Y-W%U)
    MONTH=$(date -j -f %Y-%m-%d "$d" +%Y-%m)
  fi

  # Keep the most recent backup for each week
  if [[ -z "${WEEKLY_BACKUPS[$WEEK]}" || "$d" > "${WEEKLY_BACKUPS[$WEEK]}" ]]; then
    WEEKLY_BACKUPS[$WEEK]=$d
  fi

  # Keep the most recent backup for each month
  if [[ -z "${MONTHLY_BACKUPS[$MONTH]}" || "$d" > "${MONTHLY_BACKUPS[$MONTH]}" ]]; then
    MONTHLY_BACKUPS[$MONTH]=$d
  fi
done

# Apply retention policy
log "Applying retention policy"
DELETED_COUNT=0
KEPT_COUNT=0

for d in $BACKUP_DATES; do
  SHOULD_KEEP=0
  KEEP_REASON=""

  # Rule 1: Keep all backups from the last DAILY_RETENTION_DAYS days
  if [[ "$d" > "$DAILY_CUTOFF" ]]; then
    SHOULD_KEEP=1
    KEEP_REASON="daily retention"
  fi

  # Rule 2: Keep weekly backups for WEEKLY_RETENTION_WEEKS
  if [[ $SHOULD_KEEP -eq 0 && "$d" > "$WEEKLY_CUTOFF" ]]; then
    # Get week for this backup
    if date -d "$d" &>/dev/null 2>&1; then
      WEEK=$(date -d "$d" +%Y-W%U)
    else
      WEEK=$(date -j -f %Y-%m-%d "$d" +%Y-W%U)
    fi

    # Check if this is the selected weekly backup
    if [[ "${WEEKLY_BACKUPS[$WEEK]}" == "$d" ]]; then
      SHOULD_KEEP=1
      KEEP_REASON="weekly retention"
    fi
  fi

  # Rule 3: Keep monthly backups indefinitely
  if [[ $SHOULD_KEEP -eq 0 ]]; then
    # Get month for this backup
    if date -d "$d" &>/dev/null 2>&1; then
      MONTH=$(date -d "$d" +%Y-%m)
    else
      MONTH=$(date -j -f %Y-%m-%d "$d" +%Y-%m)
    fi

    # Check if this is the selected monthly backup
    if [[ "${MONTHLY_BACKUPS[$MONTH]}" == "$d" ]]; then
      SHOULD_KEEP=1
      KEEP_REASON="monthly retention"
    fi
  fi

  # Keep or delete based on rules
  if [[ $SHOULD_KEEP -eq 1 ]]; then
    log "Keeping backup: $d ($KEEP_REASON)"
    KEPT_COUNT=$((KEPT_COUNT + 1))
  else
    log "Deleting old backup: $d"
    FOLDER="$REMOTE/$d"

    if rclone delete "$FOLDER" --drive-use-trash && \
       rclone rmdir "$FOLDER"; then
      DELETED_COUNT=$((DELETED_COUNT + 1))
    else
      log "WARNING: Failed to delete backup $d"
    fi
  fi
done

# Summarize retention results
log "Retention policy applied. Kept: $KEPT_COUNT backups. Deleted: $DELETED_COUNT backups."
log "Backup process completed successfully"

exit 0
