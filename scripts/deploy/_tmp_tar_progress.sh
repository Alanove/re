#!/usr/bin/env bash
set -euo pipefail
TAR=/www/backup/path/wwwroot/path_wwwroot_20260823_013003_XTJ1sB.tar.gz
SIZE=$(stat -c%s "$TAR")
echo "tar_size_bytes=$SIZE"
PID=$(pgrep -f 'tar -xzf /www/backup/path/wwwroot/path_wwwroot_20260823' | head -1 || true)
echo "tar_pid=${PID:-none}"
check_proc() {
  local p=$1 label=$2
  for fd in /proc/$p/fd/*; do
    target=$(readlink "$fd" 2>/dev/null || true)
    if [[ "$target" == "$TAR" ]]; then
      fdnum=$(basename "$fd")
      pos=$(awk '/^pos:/ {print $2; exit}' /proc/$p/fdinfo/$fdnum 2>/dev/null || echo "?")
      echo "${label}_fd=$fdnum ${label}_pos=$pos"
      if [[ "$pos" =~ ^[0-9]+$ ]]; then
        pct=$(awk -v p="$pos" -v s="$SIZE" 'BEGIN{printf "%.1f", (p/s)*100}')
        mb=$(awk -v p="$pos" 'BEGIN{printf "%.0f", p/1024/1024}')
        echo "${label}_progress_pct=$pct ${label}_read_mb=$mb"
      fi
    fi
  done
}
if [[ -n "${PID:-}" ]]; then
  check_proc "$PID" ta
  for cpid in $(pgrep -P "$PID" 2>/dev/null); do
    echo "child=$cpid $(tr '\0' ' ' </proc/$cpid/cmdline 2>/dev/null)"
    check_proc "$cpid" child
  done
fi
ps -p 705766 -o etime= 2>/dev/null | awk '{print "parent_etime="$1}' || echo "parent_gone"
grep -E 'tar exit|SUMMARY|Done|Live after' /www/deploy/tmp/guerra-images-restore.log 2>/dev/null || true
