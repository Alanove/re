#!/usr/bin/env bash
set -euo pipefail
sp=/www/wwwroot/antonioscouture.com
for d in public/uploads public/images public/pages; do
  if [[ -d "$sp/$d" ]]; then
    size="$(du -sh "$sp/$d" 2>/dev/null | cut -f1)"
    files="$(find "$sp/$d" -type f 2>/dev/null | wc -l | tr -d ' ')"
    printf 'PRESENT\t%s\t%s\t%s\n' "$d" "$size" "$files"
  else
    printf 'ABSENT\t%s\t-\t0\n' "$d"
  fi
done
echo '--- env ---'
if [[ -f "$sp/.env" ]]; then
  echo 'ENV_FILE:.env'
  # print only non-secret keys for confirmation
  grep -E '^(NODE_ENV|PORT|DB_HOST|DB_PORT|DB_USER|DB_NAME|APP_URL|COOKIE_DOMAIN)=' "$sp/.env" || true
elif [[ -f "$sp/.env.production" ]]; then
  echo 'ENV_FILE:.env.production'
  grep -E '^(NODE_ENV|PORT|DB_HOST|DB_PORT|DB_USER|DB_NAME|APP_URL|COOKIE_DOMAIN)=' "$sp/.env.production" || true
else
  echo 'ENV_FILE:missing'
fi
