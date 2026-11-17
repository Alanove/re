#!/usr/bin/env bash
# Scrape Cloudflare-cached guerrasports images into a staging tree (not live public/).
# Only saves HIT / STALE / UPDATING + HTTP 200. Does not purge CF. Does not touch live.
set -euo pipefail

LIVE_PUB=/www/wwwroot/guerrasports/public
STAGING=/www/deploy/tmp/guerra-cdn-restore
TMP=/www/deploy/tmp
URLS="$TMP/guerra-cdn-urls.txt"
MISSING="$TMP/guerra-cdn-missing.txt"
LOG="$TMP/guerra-cdn-scrape.log"
HIT_LOG="$TMP/guerra-cdn-hits.txt"
MISS_LOG="$TMP/guerra-cdn-misses.txt"
# Apex host — www 301s and poisoned the CF-Cache-Status parse on the redirect hop.
BASE=https://guerrasports.com
ENVF=/www/wwwroot/guerrasports/.env.production
[[ -f "$ENVF" ]] || ENVF=/www/wwwroot/guerrasports/.env

mkdir -p "$TMP" "$STAGING"
exec > >(tee -a "$LOG") 2>&1

echo "==> $(date -Is) CDN scrape start"
echo "staging=$STAGING live=$LIVE_PUB base=$BASE"

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

echo "==> Exporting URLs from MySQL $DB_NAME@$DB_HOST"
export MYSQL_PWD="$DB_PASSWORD"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "
SELECT image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM product_images WHERE thumb_url IS NOT NULL AND thumb_url != ''
UNION SELECT image_url FROM product_categories WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM product_categories WHERE thumb_url IS NOT NULL AND thumb_url != ''
UNION SELECT image_url FROM variant_type_values WHERE image_url IS NOT NULL AND image_url != ''
UNION SELECT thumb_url FROM variant_type_values WHERE thumb_url IS NOT NULL AND thumb_url != ''
" "$DB_NAME" | sed 's#^/##' | sort -u > "$URLS"

TOTAL=$(wc -l < "$URLS" | tr -d ' ')
echo "Unique DB URLs: $TOTAL"

: > "$MISSING"
while IFS= read -r rel || [[ -n "$rel" ]]; do
  [[ -n "$rel" ]] || continue
  if [[ -f "$LIVE_PUB/$rel" ]] || [[ -f "$STAGING/$rel" ]]; then
    continue
  fi
  echo "$rel" >> "$MISSING"
done < "$URLS"

MISSING_N=$(wc -l < "$MISSING" | tr -d ' ')
echo "Missing on live+staging: $MISSING_N -> $MISSING"

echo "==> Probe first 5 missing URLs"
i=0
while IFS= read -r rel && [[ $i -lt 5 ]]; do
  [[ -n "$rel" ]] || continue
  i=$((i + 1))
  echo "--- probe $i: $rel"
  curl -sS -I --max-time 20 "$BASE/$rel" | tr -d '\r' | grep -iE '^(HTTP/|cf-cache-status:|age:|content-type:|content-length:)' || true
done < "$MISSING"

: > "$HIT_LOG"
: > "$MISS_LOG"
HITS=0
MISSES=0
ERRORS=0
N=0

echo "==> Scraping $MISSING_N URLs into $STAGING"
while IFS= read -r rel || [[ -n "$rel" ]]; do
  [[ -n "$rel" ]] || continue
  N=$((N + 1))
  if [[ -f "$LIVE_PUB/$rel" ]] || [[ -f "$STAGING/$rel" ]]; then
    continue
  fi

  hdr=$(mktemp)
  body=$(mktemp)
  code=$(curl -sS -L --max-time 45 -D "$hdr" -o "$body" -w '%{http_code}' "$BASE/$rel" || echo "000")
  # After -L, headers may include redirect hops; use the LAST cf-cache-status.
  status=$(tr -d '\r' < "$hdr" | awk 'BEGIN{IGNORECASE=1} /^cf-cache-status:/{s=toupper($2)} END{print s}')
  rm -f "$hdr"

  if [[ "$code" == "200" && ( "$status" == "HIT" || "$status" == "STALE" || "$status" == "UPDATING" ) ]]; then
    mkdir -p "$(dirname "$STAGING/$rel")"
    mv "$body" "$STAGING/$rel"
    chmod 644 "$STAGING/$rel" || true
    echo "$status $rel" >> "$HIT_LOG"
    HITS=$((HITS + 1))
  else
    rm -f "$body"
    echo "$code ${status:-NONE} $rel" >> "$MISS_LOG"
    if [[ "$code" == "000" ]]; then
      ERRORS=$((ERRORS + 1))
    else
      MISSES=$((MISSES + 1))
    fi
  fi

  if (( N % 50 == 0 )); then
    echo "progress n=$N hits=$HITS misses=$MISSES errors=$ERRORS"
  fi
  # light rate limit
  sleep 0.05
done < "$MISSING"

STAGED=$(find "$STAGING" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "==> $(date -Is) Done. hits=$HITS misses=$MISSES errors=$ERRORS staged_files=$STAGED"
echo "HIT log: $HIT_LOG"
echo "MISS log: $MISS_LOG"
echo "Do NOT merge yet — wait until Aug23 tar restore finishes, then:"
echo "  rsync -a --ignore-existing $STAGING/ $LIVE_PUB/"
