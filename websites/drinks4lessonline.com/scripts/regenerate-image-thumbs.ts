/**
 * Generate WebP thumbnails and persist thumb_url for product_images, product_categories,
 * variant_type_values, page_photos, and pages.page_image. Run DB migrations for thumb columns first.
 *
 * Usage:
 *   npx ts-node scripts/regenerate-image-thumbs.ts
 *   npx ts-node scripts/regenerate-image-thumbs.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
dotenv.config({ path: envPath });
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import { db } from '../src/config/database';
import { generateThumbForPublicUrl } from '../src/services/imageThumbService';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const processRows = async (
    table: string,
    idColumn: string,
    urlColumn: string,
    thumbColumn: string
  ) => {
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
        console.log(`  [dry-run] ${table} id=${row.id} <- ${url}`);
        continue;
      }
      try {
        const thumb = await generateThumbForPublicUrl(url);
        if (thumb) {
          await db.query(`UPDATE ${table} SET ${thumbColumn} = ? WHERE ${idColumn} = ?`, [thumb, row.id]);
          updated++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.error(`  Error id=${row.id} url=${url}`, e);
        errors++;
      }
    }
  };

  await processRows('product_images', 'id', 'image_url', 'thumb_url');
  await processRows('product_categories', 'id', 'image_url', 'thumb_url');
  await processRows('variant_type_values', 'id', 'image_url', 'thumb_url');
  await processRows('page_photos', 'id', 'file_path', 'thumb_url');
  await processRows('pages', 'id', 'page_image', 'page_image_thumb');

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
