#!/usr/bin/env bash
set -euo pipefail
sp=/www/wwwroot/antonioscouture.com
remote_tar=/tmp/antonio-media-pull.tar.gz
cd "$sp"
tar -czf "$remote_tar" public/uploads public/images public/pages
ls -lh "$remote_tar" | awk '{print $5}'
