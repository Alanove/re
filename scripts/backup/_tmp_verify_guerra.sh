#!/usr/bin/env bash
set -u
TAR=$(ls -1t /www/backup/sites/guerrasports/site_guerrasports_*.tar.gz | head -1)
echo "TAR=$TAR"
du -h "$TAR"
IMG=$(tar -tzf "$TAR" | grep -c 'guerrasports/public/images/' || true)
NM=$(tar -tzf "$TAR" | grep -c 'guerrasports/node_modules/' || true)
DIST=$(tar -tzf "$TAR" | grep -c 'guerrasports/dist/' || true)
echo "images_entries=$IMG node_modules_entries=$NM dist_entries=$DIST"
echo "exclude_filter:"
cat /www/backup-rclone-exclude.txt
echo "rclone_copy_line:"
grep -n 'rclone copy' /www/backup.sh
echo "cron:"
crontab -l | grep backup-sites
ls -lah /www/backup/sites/thronetrading.com/ /www/backup/sites/guerrasports/
