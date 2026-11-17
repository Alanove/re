#!/usr/bin/env bash
set -euo pipefail
# Kill only the scrape interpreter (not this restart script / ssh cmdline).
while read -r pid; do
  [[ -n "$pid" ]] || continue
  kill "$pid" 2>/dev/null || true
done < <(pgrep -f '/www/deploy/tmp/_tmp_guerra_cdn_scrape.sh' || true)
sleep 1
sed -i 's/\r$//' /tmp/_tmp_guerra_cdn_scrape.sh
cp /tmp/_tmp_guerra_cdn_scrape.sh /www/deploy/tmp/_tmp_guerra_cdn_scrape.sh
chmod +x /www/deploy/tmp/_tmp_guerra_cdn_scrape.sh
# Truncate logs for this run (staging files kept)
: > /www/deploy/tmp/guerra-cdn-scrape.nohup
nohup /www/deploy/tmp/_tmp_guerra_cdn_scrape.sh >/www/deploy/tmp/guerra-cdn-scrape.nohup 2>&1 &
echo "PID=$!"
sleep 12
echo '=== log ==='
tail -40 /www/deploy/tmp/guerra-cdn-scrape.log 2>/dev/null || tail -40 /www/deploy/tmp/guerra-cdn-scrape.nohup
echo '=== counts ==='
wc -l /www/deploy/tmp/guerra-cdn-hits.txt /www/deploy/tmp/guerra-cdn-misses.txt 2>/dev/null || true
find /www/deploy/tmp/guerra-cdn-restore -type f 2>/dev/null | wc -l
head -5 /www/deploy/tmp/guerra-cdn-hits.txt 2>/dev/null || true
