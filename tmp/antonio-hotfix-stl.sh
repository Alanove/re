#!/usr/bin/env bash
set -euo pipefail
LIVE=/www/wwwroot/antonioscouture.com

# Stop hung rsyncs (ignore failures for D-state)
for pid in $(pgrep -f 'rsync .*antonioscouture.com' || true); do
  kill "$pid" 2>/dev/null || true
done
sleep 2
for pid in $(pgrep -f 'rsync .*antonioscouture.com' || true); do
  kill -9 "$pid" 2>/dev/null || true
done
sleep 1

# Drop deploy lock if held by dead process
rm -f /www/deploy/state/antonioscouture.com/deploy.lock || true

install -o www -g www -m 644 /tmp/antonios-styles.css "$LIVE/public/css/styles.css"
install -o www -g www -m 644 /tmp/antonios-stl.scss "$LIVE/public/css/home/_shop-the-look.scss"

if [[ -f "$LIVE/.env" ]]; then
  cp -f "$LIVE/.env" "/www/deploy/state/antonioscouture.com/env-backups/.env.pre-1.0.7-$(date +%Y%m%d-%H%M%S)" || true
fi
install -o www -g www -m 600 /tmp/antonios-env.production "$LIVE/.env"

printf '%s\n' '4115cb8dbf689df40f992c28f36e32315f41dc6e' > /www/deploy/state/antonioscouture.com/current-sha
chown www:www /www/deploy/state/antonioscouture.com/current-sha

grep ASSET_VERSION "$LIVE/.env" | tail -1
ls -la "$LIVE/public/css/styles.css"
grep -o 'aspect-ratio:2/3' "$LIVE/public/css/styles.css" | head -1

/www/server/nodejs/vhost/scripts/antonioscouture.sh
sleep 4
curl -s -o /dev/null -w 'health:%{http_code}\n' http://127.0.0.1:3013/

rm -f /tmp/antonios-styles.css /tmp/antonios-env.production /tmp/antonios-stl.scss /tmp/antonio-hotfix-stl.sh
echo HOTFIX_OK
