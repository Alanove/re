
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });

import { db } from '../config/database';

async function migrateCategoryImages() {
  console.log('Starting category image migration...');

  try {
    // 1. Get all categories with images that NOT already in the new format
    // We look for images that start with '/images/category-' but NOT '/images/categories/'
    // Actually, simpler: just look for '/images/category-' and replace with '/images/categories/category-' 
    // BUT we must be careful not to double migrate if I run this twice.
    // The previous path was like `/images/category-123.jpg`
    // The new path should be `/images/categories/category-123.jpg`
    
    // Select categories where image_url starts with /images/category-
    const [categories] = await db.query(
      "SELECT id, image_url FROM product_categories WHERE image_url LIKE '/images/category-%'"
    );

    console.log(`Found ${categories.length} categories to migrate.`);

    for (const cat of categories as any[]) {
      const oldPath = cat.image_url;
      // transformations: /images/category-XYZ -> /images/categories/category-XYZ
      const newPath = oldPath.replace('/images/', '/images/categories/');
      
      console.log(`Migrating ID ${cat.id}: ${oldPath} -> ${newPath}`);

      await db.query(
        'UPDATE product_categories SET image_url = ? WHERE id = ?',
        [newPath, cat.id]
      );
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateCategoryImages();
