#!/usr/bin/env bash
# On server: build JSONL jobs for missing full images that still have a thumb.webp
set -euo pipefail
PUB=/www/wwwroot/guerrasports/public
MISS=/www/deploy/tmp/guerra-missing-paths.txt
OUT=/www/deploy/tmp/guerra-upscale-jobs.txt
SKIP=/www/deploy/tmp/guerra-upscale-skipped.txt
: > "$OUT"
: > "$SKIP"
n=0
s=0
while IFS= read -r rel || [[ -n "${rel:-}" ]]; do
  rel="${rel#"${rel%%[![:space:]]*}"}"
  rel="${rel%"${rel##*[![:space:]]}"}"
  [[ -n "$rel" ]] || continue
  rel="${rel#/}"
  # only full images (not thumbs)
  [[ "$rel" == *"/thumbs/"* ]] && continue
  stem=$(basename "$rel")
  stem="${stem%.*}"
  dir=$(dirname "$rel")
  thumb="$dir/thumbs/${stem}.webp"
  if [[ -f "$PUB/$thumb" ]]; then
    echo "$rel|$thumb" >> "$OUT"
    n=$((n + 1))
  else
    echo "$rel" >> "$SKIP"
    s=$((s + 1))
  fi
done < "$MISS"
echo "jobs=$n skipped_no_thumb=$s"
echo "jobs_file=$OUT"
head -5 "$OUT"
