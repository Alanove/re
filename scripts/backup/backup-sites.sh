#!/usr/bin/env bash
# Daily per-site path backups for /www/wwwroot.
# Installed on the server as /www/backup-sites.sh (root cron, 02:15).
# Usage:
#   backup-sites.sh              # all eligible sites
#   backup-sites.sh guerrasports # one site only (smoke / restore prep)
set -Eeuo pipefail

WWWROOT="${WWWROOT:-/www/wwwroot}"
BACKUP_ROOT="${BACKUP_ROOT:-/www/backup/sites}"
LOG_FILE="${LOG_FILE:-/var/log/site-backup.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/site-backup.lock}"
STAMP="$(date +%Y%m%d_%H%M%S)"
# Local archives are removed by /www/backup.sh after a verified Drive copy.
# Do not prune here — a failed upload must still leave the tars on disk.

# First-level dirs under wwwroot that are not real sites.
SKIP_NAMES=(
  default
  public
)
SKIP_PREFIXES=(
  liteweb-backup-
)

log() { printf '[site-backup %s] %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

should_skip() {
  local name="$1" skip
  # Reject empty or junk names (spaces, quotes, backticks, leading dots).
  [[ -n "$name" ]] || return 0
  case "$name" in
    .*|*[\ \'\"\`]*) return 0 ;;
  esac
  for skip in "${SKIP_NAMES[@]}"; do
    [[ "$name" == "$skip" ]] && return 0
  done
  for skip in "${SKIP_PREFIXES[@]}"; do
    [[ "$name" == "$skip"* ]] && return 0
  done
  return 1
}

backup_one() {
  local site="$1"
  local src="$WWWROOT/$site"
  local dest_dir="$BACKUP_ROOT/$site"
  local out="$dest_dir/site_${site}_${STAMP}.tar.gz"
  local partial="$out.partial"

  [[ -d "$src" ]] || { log "SKIP $site (not a directory)"; return 0; }
  mkdir -p "$dest_dir"

  log "START $site -> $out"
  # Rebuildable / regenerable trees excluded; keep public/, data/, content/, uploads/images/pages.
  # Member names are "<site>/...", so exclude that prefix (./node_modules would not match).
  # cache/ is huge on some PHP sites (e.g. lebanoninapicture) and must not block the daily run.
  if tar -czf "$partial" \
      --exclude="${site}/node_modules" \
      --exclude="${site}/logs" \
      --exclude="${site}/.git" \
      --exclude="${site}/dist" \
      --exclude="${site}/cache" \
      -C "$WWWROOT" "$site"; then
    mv -f "$partial" "$out"
    chmod 640 "$out" 2>/dev/null || true
    log "OK $site ($(du -h "$out" | awk '{print $1}'))"
  else
    rm -f "$partial"
    log "FAIL $site"
    return 1
  fi

  return 0
}

main() {
  [[ "$(id -u)" -eq 0 ]] || die "Must run as root (need write to $BACKUP_ROOT and $LOG_FILE)"
  [[ -d "$WWWROOT" ]] || die "Missing $WWWROOT"
  mkdir -p "$BACKUP_ROOT" "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
  touch "$LOG_FILE"

  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    die "Another site-backup run holds $LOCK_FILE"
  fi

  local -a sites=()
  local failed=0 site name

  if (($# > 0)); then
    for name in "$@"; do
      should_skip "$name" && die "Refusing to back up skipped name: $name"
      sites+=("$name")
    done
  else
    for site in "$WWWROOT"/*; do
      [[ -d "$site" ]] || continue
      name="$(basename "$site")"
      should_skip "$name" && continue
      sites+=("$name")
    done
  fi

  ((${#sites[@]} > 0)) || die "No sites to back up"

  log "=== run begin (${#sites[@]} site(s), stamp=$STAMP) ==="
  for site in "${sites[@]}"; do
    if ! backup_one "$site"; then
      failed=1
    fi
  done

  if [[ $failed -eq 0 ]]; then
    log "=== run complete OK ==="
    return 0
  fi
  log "=== run complete WITH FAILURES ==="
  return 1
}

main "$@"
