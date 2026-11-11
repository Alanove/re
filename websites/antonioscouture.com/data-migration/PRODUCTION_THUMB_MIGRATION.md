# Thumb URL migration — production

Adds nullable `thumb_url` to `product_images`, `product_categories`, and `variant_type_values`. A separate migration adds `thumb_url` to **`page_photos`** (CMS page gallery at the bottom of `page.ejs` / news articles).

## Why `migrate:production` says “no pending migrations” but columns are missing

The runner (`data-migration/run-migrations.ts`) only runs a file if its **exact filename** is **not** in the `_migrations` table. If a row was inserted without the migration ever running (for example `npm run migrate:mark-applied --all`, a restored database, or a manual insert), the thumb migration is **skipped** forever.

**Verify on MySQL:**

```sql
SELECT migration_name, applied_at FROM _migrations
WHERE migration_name LIKE '%thumb%' OR migration_name LIKE '%2026-03-21%';

SHOW COLUMNS FROM product_images WHERE Field = 'thumb_url';
SHOW COLUMNS FROM variant_type_values WHERE Field = 'thumb_url';
SHOW COLUMNS FROM product_categories WHERE Field = 'thumb_url';
SHOW COLUMNS FROM page_photos WHERE Field = 'thumb_url';
```

**Page gallery (`page_photos`):** if that column is missing, run `npm run migrate:page-photos-thumb:production` (or apply `data-migration/sql/2026-03-22-add-page-photos-thumb-url.sql`), then `npm run thumbs:regenerate:production` to backfill WebP + DB paths.

**Featured page image (`pages.page_image_thumb`):** used for Events carousel and other listings. Add with `npm run migrate:pages-page-image-thumb` (or `data-migration/sql/2026-03-23-add-pages-page-image-thumb.sql`), then `npm run thumbs:regenerate` so existing `page_image` rows get WebP + `page_image_thumb` in the DB. New uploads refresh the thumb in `pagesService.refreshPageImageThumb`.

- If `_migrations` lists `2026-03-21-add-image-thumb-url-columns.ts` but `thumb_url` columns are missing, either run **Option B (direct)** below (idempotent), or `DELETE` that row from `_migrations` and run `npm run migrate:production` again — but the direct script is simpler and safe.

## Option A — Full migration queue (`run-migrations.ts`)

From the **project root** on the server (with `node_modules` installed):

```bash
cd /path/to/guerrasports
npm run migrate:production
```

This runs all **pending** migrations (same as `npm run migrate`, but with `NODE_ENV=production` so `.env.production` is loaded).

Check status:

```bash
npm run migrate:status:production
```

## Option B — Thumb columns only (recommended when the queue is wrong or you want to be sure)

This script checks `SHOW COLUMNS` before each `ALTER` and is **safe to run multiple times**. It does **not** depend on `_migrations`.

```bash
cd /path/to/guerrasports
sudo -u www npm run migrate:thumb-columns:production
```

Equivalent without npm script:

```bash
cross-env NODE_ENV=production npx ts-node data-migration/2026-03-21-add-image-thumb-url-columns.ts
```

## Option C — Raw SQL (no Node)

```bash
mysql -h YOUR_HOST -u YOUR_USER -p YOUR_DATABASE < data-migration/sql/2026-03-21-add-thumb-url-columns.sql
```

If a column already exists, skip that `ALTER` or ignore the duplicate-column error.

## After migration

Thumbnails are **3:4 portrait WebP** files (default **900×1200** px) smart-cropped with Sharp `position: 'attention'` (edge, saturation, and skin-tone heuristics). Scale both dimensions together in `src/services/imageThumbService.ts` if you need a different resolution.

Optional backfill of WebP thumbnails + DB `thumb_url` values:

```bash
npm run generate:images:production
```

Same as `npm run thumbs:regenerate:production` (explicit `NODE_ENV=production` entry: `scripts/generate-images-production.ts`).

Dry run first:

```bash
npm run generate:images:production:dry
```

(Equivalent: `npm run thumbs:regenerate:production:dry`.)

### If `thumbs:regenerate` reports `updated=0` and `skipped` equals every row

The thumb script resolves image files under the project’s `public/` directory (`DATA_PATHS.PUBLIC_DIR`). Older builds used `NODE_ENV=production` to guess `dist/` vs `src/` and **mis-resolved** the project root when running `ts-node` (e.g. `PUBLIC_DIR` pointed outside the app), so **no source files were found** and nothing was generated.

**Fix:** deploy a build that includes the `data-paths.ts` fix (base dir from **actual** `dist/` vs `src/` path, not `NODE_ENV`), then re-run `npm run thumbs:regenerate:production`.

**Also check:** URLs in the DB must be **site-relative** paths like `/uploads/...` (not `https://...`). Remote URLs are skipped by design.

## `.env.production` — what to add

**No new required variables** for thumbnails or caching. The app only needs your existing DB and `NODE_ENV=production`.

**Optional (recommended for cache busting):**

```env
# Bumps the CSS/JS query string ?v=... (defaults to package.json "version" if unset)
ASSET_VERSION=1.0.1
```

Increment `ASSET_VERSION` (or bump `version` in `package.json`) whenever you deploy CSS/JS changes and want clients to fetch fresh files immediately.

**Already required for DB (unchanged):** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, etc.
