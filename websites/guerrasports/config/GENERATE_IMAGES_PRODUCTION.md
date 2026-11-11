# Generate listing images (thumbnails) — production

Builds WebP thumbnails under each image’s `thumbs/` folder and writes `thumb_url` in MySQL for:

- `product_images`, `product_categories`, `variant_type_values`, `page_photos`

**Prerequisites:** DB migrations for `thumb_url` columns have been applied (see `data-migration/PRODUCTION_THUMB_MIGRATION.md`). The app must run from the project root so `public/` paths resolve correctly.

**Local dev:** if you see `Unknown column 'thumb_url' in 'field list'` on `page_photos`, run:

```bash
npm run migrate:page-photos-thumb
```

(Uses `.env.development`.)

**Run on the server** (from project root, with `node_modules` installed):

```bash
sudo -u www npm run generate:images:production
```

**Dry run** (no writes):

```bash
sudo -u www npm run generate:images:production:dry
```

**Aliases:** `npm run thumbs:regenerate:production` and `thumbs:regenerate:production:dry` call the same generator with `NODE_ENV=production`; `generate:images:production` uses `scripts/generate-images-production.ts`, which forces production env before loading `.env.production`.
