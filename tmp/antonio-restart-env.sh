#!/usr/bin/env bash
set -euo pipefail
LIVE=/www/wwwroot/antonioscouture.com

echo "ASSET line:"
sudo -n -u www grep ASSET_VERSION "$LIVE/.env" || true
sudo -n -u www od -c "$LIVE/.env" | grep -A1 ASSET || true

# Kill current node on 3013
pids=$(ss -lntp | sed -n 's/.*:3013.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
for p in $pids; do
  echo "killing $p"
  kill "$p" 2>/dev/null || true
done
sleep 2
for p in $pids; do
  kill -9 "$p" 2>/dev/null || true
done

# aaPanel start script expects to be run in a way that can write pid/log
if [[ -x /www/server/nodejs/vhost/scripts/antonioscouture.sh ]]; then
  # Script typically must run as root; it switches to www
  bash /www/server/nodejs/vhost/scripts/antonioscouture.sh || true
fi
sleep 5

echo -n "listening: "
ss -lntp | grep 3013 || echo none
echo -n "asset href: "
curl -s http://127.0.0.1:3013/ | grep -o 'css/styles.css?v=[0-9.]*' | head -1
echo
curl -s -o /dev/null -w 'css:%{http_code}\n' 'http://127.0.0.1:3013/css/styles.css?v=1.0.7'
curl -s 'http://127.0.0.1:3013/css/styles.css?v=1.0.7' | grep -c 'aspect-ratio:2/3' || true
