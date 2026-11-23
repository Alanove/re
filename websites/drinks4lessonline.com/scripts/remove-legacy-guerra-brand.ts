/**
 * Remove the legacy "Guerra" brand (id=1, name='Guerra', slug='guerra') that was
 * created when the brands table was first added. Use this if you don't want that
 * placeholder and only want your real brands (e.g. Guerra Accessories, Guerra Apparel, etc.).
 *
 * Run: npx ts-node scripts/remove-legacy-guerra-brand.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function main(): Promise<void> {
  const [rows] = await db.query<any>(
    `SELECT id, name, slug, logo_url FROM brands WHERE name = 'Guerra' AND slug = 'guerra'`
  );
  if (rows.length === 0) {
    console.log('No legacy "Guerra" brand found. Nothing to do.');
    process.exit(0);
    return;
  }
  const brand = rows[0];
  // Only remove if it looks like the placeholder (no logo and id often 1)
  if (brand.logo_url == null || String(brand.logo_url).trim() === '') {
    await db.query('UPDATE products SET brand_id = NULL WHERE brand_id = ?', [brand.id]);
    await db.query('DELETE FROM brands WHERE id = ?', [brand.id]);
    console.log(`Removed legacy brand: id=${brand.id}, name="${brand.name}", slug="${brand.slug}"`);
  } else {
    console.log('Found a brand named "Guerra" with a logo – not removing. Delete manually in Admin if needed.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
