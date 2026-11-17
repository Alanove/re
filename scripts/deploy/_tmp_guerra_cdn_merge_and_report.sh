#!/usr/bin/env bash
# Merge Cloudflare staging into live (CDN overwrites), then missing report vs MySQL.
set -euo pipefail

LIVE_PUB=/www/wwwroot/guerrasports/public
STAGING=/www/deploy/tmp/guerra-cdn-restore
TMP=/www/deploy/tmp
REPORT="$TMP/guerra-images-missing-report.txt"
ENVF=/www/wwwroot/guerrasports/.env.production
[[ -f "$ENVF" ]] || ENVF=/www/wwwroot/guerrasports/.env
LOG="$TMP/guerra-cdn-merge.log"

mkdir -p "$TMP"
exec > >(tee -a "$LOG") 2>&1

echo "==> $(date -Is) merge + missing report"

STAGED=$(find "$STAGING" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "staging files=$STAGED path=$STAGING"
[[ "$STAGED" -gt 0 ]] || { echo "ERROR: staging empty"; exit 1; }

echo "==> rsync staging -> live (Cloudflare overwrites Aug23)"
rsync -a --info=stats2 "$STAGING/" "$LIVE_PUB/"
chown -R www:www "$LIVE_PUB/images" 2>/dev/null || true

read_env() {
  local key="$1" def="${2:-}"
  local v
  v=$(sed -nE "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
  echo "${v:-$def}"
}

DB_HOST=$(read_env DB_HOST 127.0.0.1)
DB_PORT=$(read_env DB_PORT 3306)
DB_USER=$(read_env DB_USER)
DB_PASSWORD=$(read_env DB_PASSWORD)
DB_NAME=$(read_env DB_NAME guerra)
export MYSQL_PWD="$DB_PASSWORD"

URLS="$TMP/guerra-cdn-urls-fresh.txt"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "
SELECT image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM product_images WHERE thumb_url IS NOT NULL AND thumb_url != ''
UNION SELECT image_url FROM product_categories WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM product_categories WHERE thumb_url IS NOT NULL AND thumb_url != ''
UNION SELECT image_url FROM variant_type_values WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM variant_type_values WHERE thumb_url IS NOT NULL AND thumb_url != ''
" "$DB_NAME" | sed 's#^/##' | sort -u > "$URLS"

{
  echo "Generated: $(date -Is)"
  echo "Live: $LIVE_PUB"
  echo "CDN staging merged (overwrite): $STAGING ($STAGED files)"
  echo ""
} > "$REPORT"

check_table() {
  local title="$1" sql="$2" outvar="$3"
  local total=0 missing=0
  local section="$TMP/guerra-missing-section-$$.txt"
  : > "$section"
  while IFS=$'\t' read -r id url; do
    [[ -n "${url:-}" ]] || continue
    total=$((total + 1))
    rel="${url#/}"
    if [[ ! -f "$LIVE_PUB/$rel" ]]; then
      missing=$((missing + 1))
      echo "MISSING id=$id $url" >> "$section"
    fi
  done < <(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "$sql" "$DB_NAME")
  {
    echo "=== $title ==="
    echo "total=$total missing=$missing present=$((total - missing))"
    if [[ $missing -gt 0 ]]; then
      cat "$section"
    fi
    echo ""
  } | tee -a "$REPORT"
  rm -f "$section"
  printf -v "$outvar" '%s' "$missing"
}

echo "==> Missing report vs MySQL"
check_table "product_images.image_url" \
  "SELECT product_id, image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''" M1
check_table "product_images.thumb_url" \
  "SELECT product_id, thumb_url FROM product_images WHERE thumb_url IS NOT NULL AND thumb_url != ''" M2
check_table "product_categories.image_url" \
  "SELECT id, image_url FROM product_categories WHERE image_url IS NOT NULL AND image_url != ''" M3
check_table "product_categories.thumb_url" \
  "SELECT id, thumb_url FROM product_categories WHERE thumb_url IS NOT NULL AND thumb_url != ''" M4
check_table "variant_type_values.image_url" \
  "SELECT id, image_url FROM variant_type_values WHERE image_url IS NOT NULL AND image_url != ''" M5
check_table "variant_type_values.thumb_url" \
  "SELECT id, thumb_url FROM variant_type_values WHERE thumb_url IS NOT NULL AND thumb_url != ''" M6
# Unique missing paths
MISS_PATHS="$TMP/guerra-missing-paths.txt"
: > "$MISS_PATHS"
while IFS= read -r rel; do
  [[ -n "$rel" ]] || continue
  [[ -f "$LIVE_PUB/$rel" ]] || echo "$rel" >> "$MISS_PATHS"
done < "$URLS"
sort -u "$MISS_PATHS" -o "$MISS_PATHS"
UNIQUE=$(wc -l < "$MISS_PATHS" | tr -d ' ')

{
  echo "=== SUMMARY ==="
  echo "product_images image_url missing=$M1"
  echo "product_images thumb_url missing=$M2"
  echo "product_categories image_url missing=$M3"
  echo "product_categories thumb_url missing=$M4"
  echo "variant_type_values image_url missing=$M5"
  echo "variant_type_values thumb_url missing=$M6"
  echo "unique missing paths=$UNIQUE"
  echo "unique missing list: $MISS_PATHS"
  echo "full report: $REPORT"
} | tee -a "$REPORT"

echo "==> $(date -Is) Done."
