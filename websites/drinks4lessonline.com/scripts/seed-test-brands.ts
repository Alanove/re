import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

const testBrands = [
  {
    name: 'Nike',
    slug: 'nike',
    description: 'Just Do It - Leading sports brand for athletic footwear and apparel',
    website_url: 'https://www.nike.com',
    is_featured: true,
    display_order: 10
  },
  {
    name: 'Adidas',
    slug: 'adidas',
    description: 'Impossible is Nothing - Premium sports equipment and clothing',
    website_url: 'https://www.adidas.com',
    is_featured: true,
    display_order: 20
  },
  {
    name: 'Under Armour',
    slug: 'under-armour',
    description: 'Performance apparel, footwear and accessories',
    website_url: 'https://www.underarmour.com',
    is_featured: true,
    display_order: 30
  },
  {
    name: 'Puma',
    slug: 'puma',
    description: 'Forever Faster - Sports lifestyle brand',
    website_url: 'https://www.puma.com',
    is_featured: false,
    display_order: 40
  },
  {
    name: 'Reebok',
    slug: 'reebok',
    description: 'Be More Human - Fitness and lifestyle brand',
    website_url: 'https://www.reebok.com',
    is_featured: false,
    display_order: 50
  }
];

(async () => {
  try {
    console.log('🌱 Seeding test brands...\n');

    for (const brand of testBrands) {
      await db.query(
        `INSERT INTO brands (name, slug, description, website_url, is_featured, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE 
           description = VALUES(description),
           website_url = VALUES(website_url),
           is_featured = VALUES(is_featured),
           display_order = VALUES(display_order)`,
        [brand.name, brand.slug, brand.description, brand.website_url, brand.is_featured, brand.display_order]
      );
      console.log(`  ✓ Added/Updated: ${brand.name}`);
    }

    console.log('\n✅ Test brands seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding brands:', error);
    process.exit(1);
  }
})();
