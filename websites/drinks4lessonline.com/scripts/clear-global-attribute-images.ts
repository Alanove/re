/**
 * One-time cleanup: remove global attribute value images that were wrongly stored
 * on variant_type_values (shared across all products). Per-product images belong
 * in product_images only.
 *
 * Run: npx ts-node scripts/clear-global-attribute-images.ts
 */
import dotenv from 'dotenv';
import * as path from 'path';
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function main() {
  const [rows] = await db.query<any>(
    `SELECT id, value, image_url FROM variant_type_values
     WHERE image_url IS NOT NULL AND TRIM(image_url) != ''`
  );

  console.log(`Clearing ${rows.length} global attribute value image(s) from variant_type_values...`);
  for (const row of rows) {
    console.log(`  value ${row.id} (${row.value}): ${row.image_url}`);
  }

  if (rows.length > 0) {
    await db.query(
      `UPDATE variant_type_values SET image_url = NULL, thumb_url = NULL
       WHERE image_url IS NOT NULL AND TRIM(image_url) != ''`
    );
  }

  console.log('Done. Per-product images in product_images are unchanged.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
