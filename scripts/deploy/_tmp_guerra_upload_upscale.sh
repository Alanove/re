#!/usr/bin/env bash
# Merge AI-upscaled FULL images only into live public (never write under **/thumbs/**).
set -euo pipefail
SRC=/tmp/guerra-upscale-out
LIVE=/www/wwwroot/guerrasports/public
REPORT_SCRIPT=/tmp/_tmp_guerra_cdn_merge_and_report.sh

echo "==> $(date -Is) upload upscaled fulls"
[[ -d "$SRC" ]] || { echo "missing $SRC"; exit 1; }

# Safety: refuse if any thumbs slipped into the upload tree
if find "$SRC" -type f -path '*/thumbs/*' | grep -q .; then
  echo "ERROR: upload tree contains thumbs paths; aborting"
  find "$SRC" -type f -path '*/thumbs/*' | head
  exit 1
fi

n=$(find "$SRC" -type f | wc -l | tr -d ' ')
echo "files_to_upload=$n"
rsync -a --info=stats2 "$SRC/" "$LIVE/"
# Only chown the product/category trees we touched (not wiping thumbs ownership elsewhere)
chown -R www:www "$LIVE/images/products" "$LIVE/images/categories" 2>/dev/null || true

# Re-run missing report only (no CDN merge). Inline compact report:
ENVF=/www/wwwroot/guerrasports/.env.production
[[ -f "$ENVF" ]] || ENVF=/www/wwwroot/guerrasports/.env
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
PUB="$LIVE"
REPORT=/www/deploy/tmp/guerra-images-missing-report.txt
MISS=/www/deploy/tmp/guerra-missing-paths.txt
URLS=/www/deploy/tmp/guerra-cdn-urls-fresh.txt

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
  echo "After AI upscale of full images from thumbs (thumbs untouched)"
  echo "Uploaded fulls: $n"
  echo ""
} > "$REPORT"

summarize() {
  local title="$1" sql="$2"
  local total=0 missing=0
  local section
  section=$(mktemp)
  while IFS=$'\t' read -r id url; do
    [[ -n "${url:-}" ]] || continue
    total=$((total + 1))
    rel="${url#/}"
    if [[ ! -f "$PUB/$rel" ]]; then
      missing=$((missing + 1))
      echo "MISSING id=$id $url" >> "$section"
    fi
  done < <(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "$sql" "$DB_NAME")
  {
    echo "=== $title ==="
    echo "total=$total missing=$missing present=$((total - missing))"
    [[ $missing -gt 0 ]] && cat "$section"
    echo ""
  } | tee -a "$REPORT"
  rm -f "$section"
  echo "$missing"
}

M1=$(summarize "product_images.image_url" "SELECT product_id, image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''")
M2=$(summarize "product_images.thumb_url" "SELECT product_id, thumb_url FROM product_images WHERE thumb_url IS NOT NULL AND thumb_url != ''")
M3=$(summarize "product_categories.image_url" "SELECT id, image_url FROM product_categories WHERE image_url IS NOT NULL AND image_url != ''")
M4=$(summarize "product_categories.thumb_url" "SELECT id, thumb_url FROM product_categories WHERE thumb_url IS NOT NULL AND thumb_url != ''")
M5=$(summarize "variant_type_values.image_url" "SELECT id, image_url FROM variant_type_values WHERE image_url IS NOT NULL AND image_url != ''")
M6=$(summarize "variant_type_values.thumb_url" "SELECT id, thumb_url FROM variant_type_values WHERE thumb_url IS NOT NULL AND thumb_url != ''")

: > "$MISS"
while IFS= read -r rel; do
  [[ -n "$rel" ]] || continue
  [[ -f "$PUB/$rel" ]] || echo "$rel" >> "$MISS"
done < "$URLS"
sort -u "$MISS" -o "$MISS"
UNIQUE=$(wc -l < "$MISS" | tr -d ' ')

{
  echo "=== SUMMARY ==="
  echo "product_images image_url missing=$M1"
  echo "product_images thumb_url missing=$M2"
  echo "product_categories image_url missing=$M3"
  echo "product_categories thumb_url missing=$M4"
  echo "variant_type_values image_url missing=$M5"
  echo "variant_type_values thumb_url missing=$M6"
  echo "unique missing paths=$UNIQUE"
  echo "unique missing list: $MISS"
  echo "full report: $REPORT"
} | tee -a "$REPORT"

echo "==> $(date -Is) Done."
