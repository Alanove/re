/**
 * Copy existing product images into per-product folders (/images/products/{id}/)
 * and update product_images URLs. Original files are kept for backward compatibility.
 *
 * Run via migration runner (production):
 *   npm run migrate:production
 *   npm run migrate:production:built
 *
 * Or directly:
 *   npm run migrate:product-images:production
 */
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import { getProductImagesDirPath } from '../src/constants/data-paths';
import {
  generateThumbForPublicUrl,
  publicUrlToAbsolutePath,
} from '../src/services/imageThumbService';
import { migratedProductImageUrls } from '../src/services/productImageUrlService';

function copyIfMissing(srcAbs: string, destAbs: string): boolean {
  if (!fs.existsSync(srcAbs)) return false;
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  if (fs.existsSync(destAbs)) return true;
  fs.copyFileSync(srcAbs, destAbs);
  return true;
}

export default async function migrateProductImagesToFolders(): Promise<void> {
  console.log('\n🔄 Migrating product images to per-product folders...\n');

  const [rows] = await db.query<any>(
    `SELECT id, product_id, image_url, thumb_url
     FROM product_images
     WHERE image_url IS NOT NULL AND TRIM(image_url) != ''
     ORDER BY product_id, id`
  );

  console.log(`Found ${rows.length} product_images row(s) to process.\n`);

  let copied = 0;
  let skipped = 0;
  let missing = 0;
  let updated = 0;

  for (const row of rows) {
    const productId = row.product_id as number;
    const oldImageUrl = String(row.image_url).trim();
    const prefix = `/images/products/${productId}/`;

    if (oldImageUrl.startsWith(prefix)) {
      skipped++;
      continue;
    }

    const { image_url: newImageUrl, thumb_url: expectedThumbUrl } = migratedProductImageUrls(
      productId,
      oldImageUrl
    );

    const srcAbs = publicUrlToAbsolutePath(oldImageUrl);
    const destAbs = path.join(getProductImagesDirPath(productId), path.basename(newImageUrl));

    if (!srcAbs || !copyIfMissing(srcAbs, destAbs)) {
      console.warn(`  [skip] product ${productId} image ${row.id}: source missing (${oldImageUrl})`);
      missing++;
      continue;
    }
    copied++;

    let newThumbUrl: string | null = row.thumb_url ? String(row.thumb_url).trim() : null;
    const oldThumbUrl = newThumbUrl;

    if (oldThumbUrl && !oldThumbUrl.startsWith(`/images/products/${productId}/`)) {
      const thumbSrcAbs = publicUrlToAbsolutePath(oldThumbUrl);
      const thumbDestAbs = path.join(
        getProductImagesDirPath(productId),
        'thumbs',
        path.basename(expectedThumbUrl)
      );
      if (thumbSrcAbs && copyIfMissing(thumbSrcAbs, thumbDestAbs)) {
        newThumbUrl = expectedThumbUrl;
      }
    }

    if (!newThumbUrl || !newThumbUrl.startsWith(`/images/products/${productId}/`)) {
      newThumbUrl = await generateThumbForPublicUrl(newImageUrl);
    }

    await db.query(
      'UPDATE product_images SET image_url = ?, thumb_url = ? WHERE id = ?',
      [newImageUrl, newThumbUrl, row.id]
    );
    updated++;

    console.log(`  product ${productId} #${row.id}: ${oldImageUrl} -> ${newImageUrl}`);
  }

  console.log('\n✅ Product image folder migration completed.');
  console.log(`  copied: ${copied}, db updated: ${updated}, already migrated: ${skipped}, missing source: ${missing}`);
  console.log('  Original files were not deleted.\n');
}

if (require.main === module) {
  migrateProductImagesToFolders()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Migration failed:', e);
      process.exit(1);
    });
}
