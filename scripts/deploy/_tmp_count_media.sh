#!/usr/bin/env bash
set -euo pipefail
ROOT=/www/wwwroot/guerrasports/public
echo -n "products: "; find "$ROOT/images/products" -type f 2>/dev/null | wc -l
echo -n "product_dirs: "; find "$ROOT/images/products" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l
echo -n "categories: "; find "$ROOT/images/categories" -type f 2>/dev/null | wc -l
echo -n "slides: "; find "$ROOT/images/slide" -type f 2>/dev/null | wc -l
echo -n "pages: "; find "$ROOT/pages" -type f 2>/dev/null | wc -l
