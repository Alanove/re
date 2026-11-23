
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env vars before anything else
const envPath = path.resolve(__dirname, '.env.development');
const result = dotenv.config({ path: envPath });

import { db } from './src/config/database';

const LOG_FILE = 'check_variants_log.txt';

function log(message: string) {
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

async function checkProductVariants() {
  try {
    fs.writeFileSync(LOG_FILE, ''); // Clear log file
    const slug = 'feels-like-butter-yoga-leggings-2';
    log(`Checking product: ${slug}`);

    const [products] = await db.query<any>('SELECT * FROM products WHERE slug = ?', [slug]);
    
    if (products.length === 0) {
      log('Product not found!');
      return;
    }

    const product = products[0];
    log(`Product found: ID=${product.id}`);

    // Check Variants
    const [variants] = await db.query<any>('SELECT * FROM product_variants WHERE product_id = ?', [product.id]);
    log(`Found ${variants.length} rows in product_variants table.`);
    
    variants.forEach((v: any) => {
      log(`Variant: ID=${v.id}, Attributes=${typeof v.attributes === 'string' ? v.attributes : JSON.stringify(v.attributes)}`);
    });

  } catch (error) {
    log(`Error: ${error}`);
  } finally {
    try {
        await db.close();
    } catch (e) {
        // ignore
    }
    process.exit();
  }
}

checkProductVariants();
