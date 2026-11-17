#!/usr/bin/env bash
# Single-pass restore of guerrasports images from Aug 23 path_wwwroot tar, then DB missing report.
set -euo pipefail

TAR=/www/backup/path/wwwroot/path_wwwroot_20260823_013003_XTJ1sB.tar.gz
LIVE=/www/wwwroot/guerrasports
PUB="$LIVE/public"
REPORT=/www/deploy/tmp/guerra-images-missing-report.txt
LOG=/www/deploy/tmp/guerra-images-restore.log

mkdir -p /www/deploy/tmp
exec > >(tee -a "$LOG") 2>&1

echo "==> $(date -Is) start single-pass restore"
[[ -f "$TAR" ]] || { echo "ERROR: missing $TAR"; exit 1; }

BEFORE_PRODUCTS=$(find "$PUB/images/products" -type f 2>/dev/null | wc -l)
BEFORE_CATS=$(find "$PUB/images/categories" -type f 2>/dev/null | wc -l)
echo "Live before: products=$BEFORE_PRODUCTS categories=$BEFORE_CATS"

echo "==> Extracting into /www/wwwroot (skip-old-files). Long run on 65GB tar."
set +e
tar -xzf "$TAR" -C /www/wwwroot --strip-components=1 --skip-old-files \
  --wildcards \
  'wwwroot/guerrasports/public/images/products/*' \
  'wwwroot/guerrasports/public/images/categories/*' \
  'wwwroot/guerrasports/public/images/slide/*' \
  'wwwroot/guerrasports/public/images/homepage/*' \
  'wwwroot/guerrasports/public/images/quill-uploads/*' \
  'wwwroot/guerrasports/public/pages/*'
RC=$?
set -e
echo "tar exit=$RC"

chown -R www:www "$PUB/images" "$PUB/pages" 2>/dev/null || true

AFTER_PRODUCTS=$(find "$PUB/images/products" -type f 2>/dev/null | wc -l)
AFTER_CATS=$(find "$PUB/images/categories" -type f 2>/dev/null | wc -l)
PRODUCT_DIRS=$(find "$PUB/images/products" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "Live after: products=$AFTER_PRODUCTS categories=$AFTER_CATS product_dirs=$PRODUCT_DIRS"

echo "==> Missing report vs MySQL"
ENVF="$LIVE/.env.production"
[[ -f "$ENVF" ]] || ENVF="$LIVE/.env"
DB_HOST=$(sed -nE 's/^[[:space:]]*DB_HOST[[:space:]]*=[[:space:]]*//p' "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
DB_PORT=$(sed -nE 's/^[[:space:]]*DB_PORT[[:space:]]*=[[:space:]]*//p' "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
DB_USER=$(sed -nE 's/^[[:space:]]*DB_USER[[:space:]]*=[[:space:]]*//p' "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
DB_PASSWORD=$(sed -nE 's/^[[:space:]]*DB_PASSWORD[[:space:]]*=[[:space:]]*//p' "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
DB_NAME=$(sed -nE 's/^[[:space:]]*DB_NAME[[:space:]]*=[[:space:]]*//p' "$ENVF" | tail -1 | tr -d '\r' | sed -E "s/^[\"']|[\"']\$//g")
[[ -n "$DB_HOST" ]] || DB_HOST=127.0.0.1
[[ -n "$DB_PORT" ]] || DB_PORT=3306

export MYSQL_PWD="$DB_PASSWORD"
{
  echo "Restore source: $TAR"
  echo "Live before products=$BEFORE_PRODUCTS categories=$BEFORE_CATS"
  echo "Live after  products=$AFTER_PRODUCTS categories=$AFTER_CATS product_dirs=$PRODUCT_DIRS"
  echo ""
  echo "=== product_images missing image_url ==="
} > "$REPORT"

TOTAL=0
MISSING=0
: > /www/deploy/tmp/guerra-missing-pids.txt
while IFS=$'\t' read -r pid url; do
  [[ -n "$url" ]] || continue
  TOTAL=$((TOTAL + 1))
  rel="${url#/}"
  if [[ ! -f "$PUB/$rel" ]]; then
    MISSING=$((MISSING + 1))
    echo "MISSING product_id=$pid $url" >> "$REPORT"
    echo "$pid" >> /www/deploy/tmp/guerra-missing-pids.txt
  fi
done < <(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e \
  "SELECT product_id, image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''" "$DB_NAME")

THUMB_TOTAL=0
THUMB_MISSING=0
while IFS=$'\t' read -r pid url; do
  [[ -n "$url" ]] || continue
  THUMB_TOTAL=$((THUMB_TOTAL + 1))
  rel="${url#/}"
  if [[ ! -f "$PUB/$rel" ]]; then
    THUMB_MISSING=$((THUMB_MISSING + 1))
  fi
done < <(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e \
  "SELECT product_id, thumb_url FROM product_images WHERE thumb_url IS NOT NULL AND thumb_url != ''" "$DB_NAME")

CAT_TOTAL=0
CAT_MISSING=0
{
  echo ""
  echo "=== category images missing ==="
} >> "$REPORT"
while IFS=$'\t' read -r cid url; do
  [[ -n "$url" ]] || continue
  CAT_TOTAL=$((CAT_TOTAL + 1))
  rel="${url#/}"
  if [[ ! -f "$PUB/$rel" ]]; then
    CAT_MISSING=$((CAT_MISSING + 1))
    echo "MISSING category_id=$cid $url" >> "$REPORT"
  fi
done < <(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e \
  "SELECT id, image_url FROM product_categories WHERE image_url IS NOT NULL AND image_url != ''" "$DB_NAME")

{
  echo ""
  echo "=== SUMMARY ==="
  echo "product_images image_url: total=$TOTAL missing=$MISSING present=$((TOTAL - MISSING))"
  echo "product_images thumb_url: total=$THUMB_TOTAL missing=$THUMB_MISSING present=$((THUMB_TOTAL - THUMB_MISSING))"
  echo "product_categories image_url: total=$CAT_TOTAL missing=$CAT_MISSING present=$((CAT_TOTAL - CAT_MISSING))"
  echo "Unique product_ids with missing image_url (first 50):"
  sort -nu /www/deploy/tmp/guerra-missing-pids.txt | head -50
} | tee -a "$REPORT"

echo "Full report: $REPORT"
echo "==> $(date -Is) Done."
