
import * as dotenv from 'dotenv';
import * as path from 'path';

// Determine environment (default to development)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from './src/config/database';

async function checkData() {
  try {
    // Get a product with variants
    const [variants] = await db.query<any[]>('SELECT * FROM product_variants WHERE is_active = TRUE LIMIT 1');
    if (variants.length === 0) {
      console.log('No variants found.');
      return;
    }
    const variant = variants[0] as any;
    console.log('Variant:', variant);
    
    const productId = variant.product_id;
    console.log('Product ID:', productId);

    // Get images for this product
    const [images] = await db.query<any[]>('SELECT * FROM product_images WHERE product_id = ?', [productId]);
    console.log('Images:', images);

    // Get variant type values to see IDs
    const [values] = await db.query<any[]>('SELECT * FROM variant_type_values');
    console.log('Variant Type Values (sample):', values.slice(0, 5));

  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

checkData();
