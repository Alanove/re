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
    console.log('\n🔄 Migration: products.include_in_auto_ads\n');
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM products WHERE Field = ?`,
      ['include_in_auto_ads']
    );
    if (cols.length > 0) {
      console.log('  ⚠️  products.include_in_auto_ads already exists — skip\n');
    } else {
      await conn.query(
        `ALTER TABLE products ADD COLUMN include_in_auto_ads BOOLEAN NOT NULL DEFAULT TRUE AFTER is_active`
      );
      console.log('  ✓ Added products.include_in_auto_ads (default TRUE)\n');
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
