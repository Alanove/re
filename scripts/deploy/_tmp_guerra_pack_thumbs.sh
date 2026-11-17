#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/guerrasports/public
cut -d'|' -f2 /www/deploy/tmp/guerra-upscale-jobs.txt > /tmp/guerra-thumbs.list
tar -czf /tmp/guerra-upscale-thumbs.tgz -T /tmp/guerra-thumbs.list
cp /www/deploy/tmp/guerra-upscale-jobs.txt /tmp/guerra-upscale-jobs.txt
chmod 644 /tmp/guerra-upscale-thumbs.tgz /tmp/guerra-upscale-jobs.txt
ls -la /tmp/guerra-upscale-thumbs.tgz /tmp/guerra-upscale-jobs.txt
wc -l /tmp/guerra-thumbs.list
