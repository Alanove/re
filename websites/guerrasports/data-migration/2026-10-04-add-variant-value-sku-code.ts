import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: variant_type_values.sku_code\n');
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM variant_type_values WHERE Field = ?`,
      ['sku_code']
    );
    if (cols.length > 0) {
      console.log('  ⚠️  variant_type_values.sku_code already exists — skip\n');
    } else {
      await conn.query(
        `ALTER TABLE variant_type_values
         ADD COLUMN sku_code VARCHAR(32) NULL COMMENT 'Short code used in generated variant SKUs, e.g. BLK'
         AFTER value`
      );
      console.log('  ✓ Added variant_type_values.sku_code\n');
    }
    console.log('✅ Done.\n');
  } finally {
    conn.release();
    await pool.end();
  }
}

if (require.main === module) {
  run().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}

export default run;
