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
    console.log('\n🔄 Migration: products.is_new_arrival\n');

    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM products WHERE Field = ?`,
      ['is_new_arrival']
    );

    if (cols.length > 0) {
      console.log('  ⚠️  products.is_new_arrival already exists — skip column add');
    } else {
      await conn.query(
        `ALTER TABLE products ADD COLUMN is_new_arrival TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured`
      );
      console.log('  ✓ Added products.is_new_arrival (default 0)');
    }

    const [idx] = await conn.query<any[]>(
      `SHOW INDEX FROM products WHERE Key_name = ?`,
      ['idx_new_arrival']
    );
    if (idx.length > 0) {
      console.log('  ⚠️  Index idx_new_arrival already exists — skip');
    } else {
      await conn.query(
        `ALTER TABLE products ADD INDEX idx_new_arrival (is_new_arrival)`
      );
      console.log('  ✓ Added index idx_new_arrival');
    }

    console.log('\n✅ Done.\n');
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
