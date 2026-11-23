
// @ts-nocheck
import dotenv from 'dotenv';
import * as path from 'path';
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from './src/config/database';

async function checkImages() {
  try {
    const slug = 'feels-like-butter-yoga-leggings-2';
    
    // 1. Get Product
    const [products] = await db.query('SELECT * FROM products WHERE slug = ?', [slug]);
    if ((products as any).length === 0) {
        console.log('Product not found');
        return;
    }
    const product = (products as any)[0];
    console.log('Product ID:', product.id);

    // 2. Get Attributes/Variants
    const [variants] = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [product.id]);
    console.log(`Found ${(variants as any).length} variants.`);
    if ((variants as any).length > 0) {
        console.log('Sample Variant Attributes:', (variants as any)[0].attributes);
    }

    // 3. Get Images
    const [images] = await db.query('SELECT id, image_url, attribute_value_id, is_primary FROM product_images WHERE product_id = ?', [product.id]);
    console.log('Images and Attribute Links:');
    (images as any).forEach((img: any) => {
        console.log(`- Image ${img.id}: ${img.image_url} (AttrValueID: ${img.attribute_value_id}) Primary: ${img.is_primary}`);
    });

    // 4. Get Attribute Values
    const [attrValues] = await db.query('SELECT * FROM variant_type_values');
    console.log('Attribute Values (first 10):');
    console.table((attrValues as any).slice(0, 10));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkImages();
