#!/usr/bin/env bash
set -euo pipefail
LIVE=/www/wwwroot/antonioscouture.com
install -o www -g www -m 644 /tmp/antonios-styles.css "$LIVE/public/css/styles.css"
install -o www -g www -m 644 /tmp/antonios-stl.scss "$LIVE/public/css/home/_shop-the-look.scss"
cp -f "$LIVE/.env" "/www/deploy/state/antonioscouture.com/env-backups/.env.pre-1.0.10-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
install -o www -g www -m 600 /tmp/antonios-env.production "$LIVE/.env"
printf '%s\n' 'stl-1.0.10' > /www/deploy/state/antonioscouture.com/current-sha
chown www:www /www/deploy/state/antonioscouture.com/current-sha
pids=$(ss -lntp | sed -n 's/.*:3013.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
for p in $pids; do kill "$p" 2>/dev/null || true; done
sleep 2
for p in $pids; do kill -9 "$p" 2>/dev/null || true; done
bash /www/server/nodejs/vhost/scripts/antonioscouture.sh
sleep 4
curl -s http://127.0.0.1:3013/ | grep -o 'css/styles.css?v=[0-9.]*' | head -1
curl -s 'http://127.0.0.1:3013/css/styles.css?v=1.0.10' | grep -o 'align-items:flex-end' | head -1
curl -s -o /dev/null -w 'health:%{http_code}\n' http://127.0.0.1:3013/
rm -f /tmp/antonios-styles.css /tmp/antonios-env.production /tmp/antonios-stl.scss /tmp/antonio-hotfix-stl-10.sh
echo HOTFIX_OK
