
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.development');
dotenv.config({ path: envPath });

import { db } from '../src/config/database';

const TARGET_STOCK = 100;

async function setStock100() {
  try {
    console.log(`Setting stock to ${TARGET_STOCK} for all products and variants...`);

    const [productsResult] = await db.query<any>(
      'UPDATE products SET stock_quantity = ?',
      [TARGET_STOCK]
    );
    const productsAffected = (productsResult as any).affectedRows ?? 0;

    const [variantsResult] = await db.query<any>(
      'UPDATE product_variants SET stock_quantity = ?',
      [TARGET_STOCK]
    );
    const variantsAffected = (variantsResult as any).affectedRows ?? 0;

    console.log(`Done. Products: ${productsAffected}, Variants: ${variantsAffected} set to stock ${TARGET_STOCK}.`);
  } catch (error) {
    console.error('Error setting stock:', error);
    process.exitCode = 1;
  } finally {
    try {
      await db.close();
    } catch (e) {}
    process.exit(process.exitCode ?? 0);
  }
}

setStock100();
