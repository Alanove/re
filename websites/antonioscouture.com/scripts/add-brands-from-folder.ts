/**
 * Add brands from public/images/brands folder.
 * Uses each file name (without extension) as the brand name.
 *
 * Run: npx ts-node scripts/add-brands-from-folder.ts
 * Or:  npm run add-brands-from-folder (if script is added to package.json)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

// Use process.cwd() so the path is correct when run via npm from project root (dev or prod)
const brandsDir = path.resolve(process.cwd(), 'public', 'images', 'brands');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function addBrandsFromFolder(): Promise<void> {
  if (!fs.existsSync(brandsDir)) {
    console.error(`❌ Directory not found: ${brandsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(brandsDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return IMAGE_EXT.includes(ext);
  });

  if (files.length === 0) {
    console.log('No image files found in', brandsDir);
    process.exit(0);
  }

  console.log(`Found ${files.length} image(s) in public/images/brands\n`);

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const baseName = path.basename(file, path.extname(file));
    const brandName = baseName;
    const slug = slugify(brandName);
    const logoUrl = `/images/brands/${file}`;

    try {
      const [existing] = await db.query<any>('SELECT id FROM brands WHERE slug = ?', [slug]);
      if (existing && existing.length > 0) {
        console.log(`  ⏭️  Skip "${brandName}" (slug "${slug}" already exists)`);
        skipped++;
        continue;
      }

      await db.query(
        `INSERT INTO brands (name, slug, logo_url, is_active, display_order)
         VALUES (?, ?, ?, TRUE, ?)`,
        [brandName, slug, logoUrl, i + 1]
      );
      console.log(`  ✅ Added: "${brandName}" → /images/brands/${file}`);
      added++;
    } catch (err: any) {
      console.error(`  ❌ ${file}:`, err.message);
    }
  }

  console.log('\n' + '—'.repeat(50));
  console.log(`Added: ${added}  |  Skipped: ${skipped}`);
  process.exit(0);
}

addBrandsFromFolder();
