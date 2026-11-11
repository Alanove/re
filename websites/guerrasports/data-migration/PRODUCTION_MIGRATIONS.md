# Database migrations — production

Run schema changes on the **live server** against the production MySQL database.

## Prerequisites

1. **`.env.production`** in the project root on the server (see `.env.production.example`).
2. **`NODE_ENV=production`** so the runner loads `.env.production` (all `migrate:*:production` scripts set this).
3. Database credentials in that file must point at the **production** database.

## Recommended deploy flow

From the project root on the server (as the app user, e.g. `www`):

```bash
cd /path/to/guerrasports
git pull
npm ci
npm run build
npm run migrate:production:built
npm run start:prod
```

`migrate:production:built` runs compiled migrations from `dist/data-migration/` — **no `ts-node` required** (works with `npm ci --omit=dev` after a build).

## Alternative: ts-node (full install)

If `devDependencies` are installed (`npm ci` without `--omit=dev`):

```bash
npm run migrate:production
```

## Check status before/after

```bash
npm run migrate:status:production:built
# or
npm run migrate:status:production
```

Pending migrations are listed as **Pending**; applied ones are in the `_migrations` table.

## Latest migration: Include in Auto Ads

Adds `products.include_in_auto_ads` (default `TRUE`) for the Meta product feed checkbox.

**Option A — full queue (recommended after deploy):**

```bash
npm run migrate:production:built
```

**Option B — this migration only (idempotent):**

```bash
npm run migrate:include-in-auto-ads:production
```

**Option C — raw SQL (no Node):**

```bash
mysql -h HOST -u USER -p DB_NAME < data-migration/sql/2026-06-14-add-include-in-auto-ads-to-products.sql
```

Then record it in `_migrations` if you use the queue elsewhere:

```sql
INSERT INTO _migrations (migration_name)
VALUES ('2026-06-14-add-include-in-auto-ads-to-products.ts');
```

(Only if that row is not already present.)

## Verify column exists

```sql
SHOW COLUMNS FROM products WHERE Field = 'include_in_auto_ads';
SELECT migration_name, applied_at FROM _migrations
WHERE migration_name LIKE '%include-in-auto-ads%';
```

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Connects to wrong DB | Check `.env.production` `DB_*` values; runner prints host/database on start |
| “No pending migrations” but column missing | Row in `_migrations` without migration running — run **Option B** or **Option C**, or delete the bad row and re-run |
| `ts-node` not found | Run `npm run build` then `npm run migrate:production:built` |
| Path with spaces (Windows) | Runner handles this automatically |

See also [PRODUCTION_THUMB_MIGRATION.md](./PRODUCTION_THUMB_MIGRATION.md) for thumbnail-related migrations.
