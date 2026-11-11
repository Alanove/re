/**
 * Generate 3:4 smart-cropped WebP thumbnails and persist thumb_url for product_images,
 * product_categories, variant_type_values, page_photos, and pages.page_image.
 * Run DB migrations for thumb columns first.
 *
 * Crop: tall portraits use fit-inside over blurred cover fill; wider sources use cover + attention.
 *
 * Usage:
 *   npx ts-node scripts/regenerate-image-thumbs.ts
 *   npx ts-node scripts/regenerate-image-thumbs.ts --dry-run
 *   npx ts-node scripts/regenerate-image-thumbs.ts --products-only
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import sharp from 'sharp';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
dotenv.config({ path: envPath });
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import { db } from '../src/config/database';
import {
  generateThumbForPublicUrl,
  publicUrlToAbsolutePath,
  THUMB_HEIGHT,
  THUMB_WIDTH,
} from '../src/services/imageThumbService';

type TableJob = {
  table: string;
  idColumn: string;
  urlColumn: string;
  thumbColumn: string;
};

const ALL_JOBS: TableJob[] = [
  { table: 'product_images', idColumn: 'id', urlColumn: 'image_url', thumbColumn: 'thumb_url' },
  { table: 'product_categories', idColumn: 'id', urlColumn: 'image_url', thumbColumn: 'thumb_url' },
  { table: 'variant_type_values', idColumn: 'id', urlColumn: 'image_url', thumbColumn: 'thumb_url' },
  { table: 'page_photos', idColumn: 'id', urlColumn: 'file_path', thumbColumn: 'thumb_url' },
  { table: 'pages', idColumn: 'id', urlColumn: 'page_image', thumbColumn: 'page_image_thumb' },
];

async function sourceDimensions(publicUrl: string): Promise<string> {
  const abs = publicUrlToAbsolutePath(publicUrl);
  if (!abs) return '?×?';
  try {
    const meta = await sharp(abs).metadata();
    if (meta.width && meta.height) return `${meta.width}×${meta.height}`;
  } catch {
    /* ignore */
  }
  return '?×?';
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const productsOnly = process.argv.includes('--products-only');
  const jobs = productsOnly ? ALL_JOBS.filter((j) => j.table === 'product_images') : ALL_JOBS;

  console.log(
    `Thumb regeneration (${THUMB_WIDTH}×${THUMB_HEIGHT}, 3:4 smart crop)${dryRun ? ' [dry-run]' : ''}${productsOnly ? ' [products-only]' : ''}`
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const processRows = async (job: TableJob) => {
    const { table, idColumn, urlColumn, thumbColumn } = job;

    const [colRows] = await db.query<any>(`SHOW COLUMNS FROM ${table}`);
    const colNames = new Set((colRows as { Field: string }[]).map((c) => c.Field));
    if (!colNames.has(urlColumn) || !colNames.has(thumbColumn)) {
      console.log(`\n${table}: skip (missing ${urlColumn} or ${thumbColumn} column)`);
      return;
    }

    const [rows] = await db.query<any>(
      `SELECT ${idColumn} AS id, ${urlColumn} AS image_url FROM ${table} WHERE ${urlColumn} IS NOT NULL AND TRIM(${urlColumn}) != ''`
    );
    console.log(`\n${table}: ${rows.length} row(s) with ${urlColumn}`);

    for (const row of rows) {
      const url = String(row.image_url || '').trim();
      if (!url || /^https?:\/\//i.test(url)) {
        skipped++;
        continue;
      }
      if (dryRun) {
        const dims = await sourceDimensions(url);
        console.log(`  [dry-run] ${table} id=${row.id} ${dims} <- ${url}`);
        continue;
      }
      try {
        const dims = await sourceDimensions(url);
        const thumb = await generateThumbForPublicUrl(url);
        if (thumb) {
          await db.query(`UPDATE ${table} SET ${thumbColumn} = ? WHERE ${idColumn} = ?`, [thumb, row.id]);
          updated++;
          console.log(`  ok ${table} id=${row.id} ${dims} -> ${thumb} (${THUMB_WIDTH}×${THUMB_HEIGHT})`);
        } else {
          skipped++;
          console.log(`  skip ${table} id=${row.id} ${dims} <- ${url} (source missing or unsupported)`);
        }
      } catch (e) {
        console.error(`  Error id=${row.id} url=${url}`, e);
        errors++;
      }
    }
  };

  for (const job of jobs) {
    await processRows(job);
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} errors=${errors}${dryRun ? ' (dry-run)' : ''}\n`);

  try {
    await db.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
