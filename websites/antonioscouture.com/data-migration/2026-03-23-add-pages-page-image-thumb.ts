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
    console.log('\n🔄 Migration: pages.page_image_thumb\n');
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM pages WHERE Field = ?`,
      ['page_image_thumb']
    );
    if (cols.length > 0) {
      console.log('  ⚠️  pages.page_image_thumb already exists — skip\n');
    } else {
      const [pageImageCol] = await conn.query<any[]>(
        `SHOW COLUMNS FROM pages WHERE Field = ?`,
        ['page_image']
      );
      const after =
        pageImageCol && pageImageCol.length > 0 ? ' AFTER page_image' : '';
      await conn.query(
        `ALTER TABLE pages ADD COLUMN page_image_thumb VARCHAR(512) NULL${after}`
      );
      console.log('  ✓ Added pages.page_image_thumb\n');
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
