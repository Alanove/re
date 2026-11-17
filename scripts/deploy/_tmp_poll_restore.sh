#!/usr/bin/env bash
set -euo pipefail
echo "=== process ==="
ps -p 705766 -o pid,etime,cmd 2>/dev/null || echo "parent gone"
pgrep -af 'tar -xzf /www/backup/path' || echo "tar gone"
echo "=== log ==="
tail -40 /www/deploy/tmp/guerra-images-restore.log 2>/dev/null || true
echo "=== counts ==="
echo -n "products files: "; find /www/wwwroot/guerrasports/public/images/products -type f 2>/dev/null | wc -l
echo -n "product dirs: "; find /www/wwwroot/guerrasports/public/images/products -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l
echo -n "categories files: "; find /www/wwwroot/guerrasports/public/images/categories -type f 2>/dev/null | wc -l
echo -n "pages files: "; find /www/wwwroot/guerrasports/public/pages -type f 2>/dev/null | wc -l
echo -n "slide files: "; find /www/wwwroot/guerrasports/public/images/slide -type f 2>/dev/null | wc -l
echo -n "homepage files: "; find /www/wwwroot/guerrasports/public/images/homepage -type f 2>/dev/null | wc -l
