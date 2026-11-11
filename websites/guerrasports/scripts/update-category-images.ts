
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function updateCategoryImages() {
  console.log('Starting category image update...');

  try {
    // Get all categories
    const [categories] = await db.query<any>('SELECT id, name FROM product_categories WHERE is_active = TRUE');
    console.log(`Found ${categories.length} active categories.`);

    for (const category of categories) {
      console.log(`Processing category: ${category.name} (ID: ${category.id})`);

      // Find first product for this category (either via category_id or product_category_relations)
      const [products] = await db.query<any>(
        `SELECT p.id, p.name 
         FROM products p 
         LEFT JOIN product_category_relations pcr ON p.id = pcr.product_id 
         WHERE (p.category_id = ? OR pcr.category_id = ?) 
         AND p.is_active = TRUE 
         AND p.status = 'published'
         ORDER BY p.id DESC
         LIMIT 2`,
        [category.id, category.id]
      );

      if (products.length === 0) {
        console.log(`  No products found for category ${category.name}. Skipping.`);
        continue;
      }

      // Prefer the second product if available, otherwise use the first
      const product = products.length > 1 ? products[1] : products[0];
      console.log(`  Found product: ${product.name} (ID: ${product.id}) ${products.length > 1 ? '(Second found)' : '(Only one found)'}`);

      // Get primary image for the product
      const [images] = await db.query<any>(
        `SELECT image_url 
         FROM product_images 
         WHERE product_id = ? 
         ORDER BY is_primary DESC, order_index ASC, id ASC 
         LIMIT 1`,
        [product.id]
      );

      if (images.length === 0) {
        console.log(`  Product ${product.name} has no images. Skipping.`);
        continue;
      }

      const imageUrl = images[0].image_url;
      console.log(`  Found product image: ${imageUrl}`);

      // Process image path
      // imageUrl might store path like '/images/product-123.jpg' or 'images/product-123.jpg'
      // We need to resolve it to absolute filesystem path
      const publicDir = path.join(process.cwd(), 'public');
      
      // Clean up the URL to get relative path
      const relativePath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      const sourcePath = path.join(publicDir, relativePath);

      if (!fs.existsSync(sourcePath)) {
        console.log(`  Source image file not found at ${sourcePath}. Skipping.`);
        continue;
      }

      // Generate new filename
      const ext = path.extname(sourcePath);
      const random = Math.floor(Math.random() * 1000000000);
      const timestamp = Date.now();
      const newFilename = `category-${timestamp}-${random}${ext}`;
      const newRelativePath = `images/${newFilename}`;
      const destPath = path.join(publicDir, 'images', newFilename);

      try {
        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        console.log(`  Copied image to ${destPath}`);

        // Update category
        await db.query(
          'UPDATE product_categories SET image_url = ? WHERE id = ?',
          [`/${newRelativePath}`, category.id]
        );
        console.log(`  Updated category ${category.name} with new image URL: /${newRelativePath}`);

      } catch (err) {
        console.error(`  Error copying file or updating database:`, err);
      }
    }

    console.log('Category image update complete.');

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    process.exit();
  }
}

updateCategoryImages();
