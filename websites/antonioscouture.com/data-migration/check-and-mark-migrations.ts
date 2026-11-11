/**
 * Check migrations by inspecting the database and mark as applied any migration
 * whose effects are already present. Use when migrations were run manually or
 * by other scripts and _migrations was not updated.
 *
 * Usage: npm run migrate:check
 *
 * Each migration has a "check" (e.g. table/column exists). If the check passes
 * and the migration is not in _migrations, it is marked as applied.
 */

import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import { dbConfig } from '../src/config/database.config';

const MIGRATIONS_TABLE = '_migrations';
const DATA_MIGRATION_DIR = path.join(__dirname);

type CheckFn = () => Promise<boolean>;

async function tableExists(tableName: string): Promise<boolean> {
  const [rows] = await db.query<Record<string, unknown>[]>(
    `SHOW TABLES LIKE ?`,
    [tableName]
  );
  return (rows || []).length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await db.query<{ Field: string }>(
    `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
    [column]
  );
  return (rows || []).length > 0;
}

async function tableHasRow(table: string): Promise<boolean> {
  const [rows] = await db.query<unknown[]>(`SELECT 1 FROM \`${table}\` LIMIT 1`);
  return (rows || []).length > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const dbName = dbConfig.database;
  const [rows] = await db.query<{ Key_name: string }>(
    `SELECT INDEX_NAME AS Key_name FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, table, indexName]
  );
  return (rows || []).length > 0;
}

/**
 * Defines how to detect if a migration has already been applied.
 * Only include migrations that can be reliably detected from schema/data.
 */
const MIGRATION_CHECKS: Record<string, CheckFn> = {
  '2025-01-15-ecommerce-schema.ts': () => tableExists('products'),
  '2025-01-15-init-payment-methods.ts': () => tableHasRow('payment_methods'),
  '2025-01-16-variant-types.ts': () => tableExists('variant_types'),
  '2026-01-07-enhance-variant-values.ts': () =>
    columnExists('variant_type_values', 'color_code'),
  '2026-01-08-create-brands-table.ts': () => tableExists('brands'),
  '2026-01-12-add-product-attribute-selection.ts': () =>
    columnExists('product_attributes', 'selected_values'),
  '2026-01-16-add-image-to-variant-values.ts': () =>
    columnExists('variant_type_values', 'image_url'),
  '2026-01-16-enhance-product-relations.ts': () =>
    tableExists('product_categories_map'),
  '2026-01-24-add-password-reset-to-users.ts': () =>
    columnExists('users', 'reset_password_token'),
  '2026-01-25-add-discount-to-cart.ts': () =>
    columnExists('shopping_carts', 'discount_code'),
  '2026-01-25-encrypt-customer-addresses.ts': () =>
    columnExists('customer_addresses', 'content_encrypted'),
  '2026-01-28-performance-indexes.ts': () =>
    indexExists('cart_items', 'idx_cart_items_lookup'),
  '2026-01-31-newsletter-subscribers.ts': () =>
    tableExists('newsletter_subscribers'),
  'add-attribute-value-images.ts': () => tableExists('product_attributes'),
  'add-session-to-wishlists.ts': () => columnExists('wishlists', 'session_id'),
  'simplify-wishlist.ts': () =>
    indexExists('wishlists', 'unique_wishlist_customer'),
  '2026-04-26-add-slider-duration-seconds.ts': () =>
    columnExists('slider', 'duration_seconds'),
  '2026-04-28-ensure-slider-duration-seconds.ts': () =>
    columnExists('slider', 'duration_seconds'),
  '2026-05-10-add-slider-video-url-mobile.ts': () =>
    columnExists('slider', 'video_url_mobile'),
  '2026-05-11-add-slider-media-type-video-poster.ts': () =>
    columnExists('slider', 'media_type'),
  '2026-05-16-home-page-content.ts': () => tableExists('home_page_content'),
  '2026-05-17-home-page-content-tagline-plain-titles.ts': async () =>
    (await tableExists('home_page_content')) &&
    (await columnExists('home_page_content', 'tagline_html')) &&
    !(await columnExists('home_page_content', 'introducing_html')),
  '2026-05-18-home-page-content-poster-tagline-html.ts': () =>
    columnExists('home_page_content', 'poster_tagline_html'),
  '2026-06-21-home-page-blocks.ts': () => tableExists('home_page_blocks'),
  // migrate-variant-images.ts is a data-only migration; no reliable schema check.
  // Mark it manually with: npm run migrate:mark-applied -- migrate-variant-images.ts
};

async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const [rows] = await db.query<{ migration_name: string }>(
    `SELECT migration_name FROM ${MIGRATIONS_TABLE}`
  );
  return new Set((rows || []).map((r) => r.migration_name));
}

function getMigrationFiles(): string[] {
  const files = fs.readdirSync(DATA_MIGRATION_DIR);
  return files
    .filter((f) => f.endsWith('.ts') && f !== 'run-migrations.ts' && f !== 'check-and-mark-migrations.ts')
    .sort();
}

async function run(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  console.log('Checking database for applied migrations...\n');

  let marked = 0;
  const noCheck: string[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  for (const filename of files) {
    if (applied.has(filename)) {
      skipped.push(filename);
      continue;
    }

    const check = MIGRATION_CHECKS[filename];
    if (!check) {
      noCheck.push(filename);
      continue;
    }

    try {
      const detected = await check();
      if (detected) {
        await db.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
          [filename]
        );
        console.log(`  ✓ Marked applied (detected): ${filename}`);
        marked++;
        applied.add(filename);
      }
    } catch (err) {
      failed.push(filename);
      console.warn(`  ✗ Check failed for ${filename}:`, (err as Error).message);
    }
  }

  console.log('');
  console.log(`Marked ${marked} migration(s) as applied.`);
  if (noCheck.length > 0) {
    console.log(
      `No check defined (mark manually if needed): ${noCheck.join(', ')}`
    );
  }
  if (failed.length > 0) {
    console.log(`Check failed (review manually): ${failed.join(', ')}`);
  }
  if (skipped.length > 0) {
    console.log(`Already in _migrations (skipped): ${skipped.length} migration(s).`);
  }
  console.log('');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
