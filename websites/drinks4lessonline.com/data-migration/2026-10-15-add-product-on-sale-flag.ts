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
    console.log('\n🔄 Migration: products.is_on_sale\n');
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM products WHERE Field = ?`,
      ['is_on_sale']
    );
    if (cols.length > 0) {
      console.log('  ⚠️  products.is_on_sale already exists — skip column');
    } else {
      await conn.query(
        `ALTER TABLE products ADD COLUMN is_on_sale BOOLEAN NOT NULL DEFAULT FALSE AFTER is_featured`
      );
      console.log('  ✓ Added products.is_on_sale (default FALSE)');
    }

    const [result] = await conn.query<mysql.ResultSetHeader>(
      `UPDATE products
       SET is_on_sale = TRUE
       WHERE compare_at_price IS NOT NULL
         AND compare_at_price <> price`
    );
    console.log(`  ✓ Marked ${result.affectedRows} product(s) on sale (compare price differs from price)\n`);
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
