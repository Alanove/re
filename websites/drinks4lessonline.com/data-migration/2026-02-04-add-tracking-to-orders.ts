// Load environment variables from .env file
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function up() {
  console.log('Adding tracking_number and waybill_label_url to orders table...');
  
  // Check if columns already exist
  const [columns] = await db.query<any>(
    `SHOW COLUMNS FROM orders LIKE 'tracking_number'`
  );
  
  if (columns.length === 0) {
    await db.query(`
      ALTER TABLE orders
        ADD COLUMN tracking_number VARCHAR(100) NULL DEFAULT NULL AFTER shipping_method,
        ADD COLUMN waybill_label_url TEXT NULL DEFAULT NULL AFTER tracking_number
    `);
    console.log('  ✓ Added tracking_number and waybill_label_url columns');
  } else {
    console.log('  ✓ Columns already exist, skipping');
  }
}

async function down() {
  await db.query(`
    ALTER TABLE orders 
      DROP COLUMN IF EXISTS tracking_number,
      DROP COLUMN IF EXISTS waybill_label_url
  `);
  console.log('  ✓ Removed tracking_number and waybill_label_url columns');
}

async function run() {
  try {
    await up();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
