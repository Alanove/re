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
    console.log('\n🔄 Migration: page_photos.thumb_url\n');
    const [tables] = await conn.query<any[]>(
      `SHOW TABLES LIKE 'page_photos'`,
    );
    if (!tables || tables.length === 0) {
      console.log('  ⚠️  page_photos table not present — skip\n');
      console.log('✅ Done.\n');
      return;
    }
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM page_photos WHERE Field = ?`,
      ['thumb_url']
    );
    if (cols.length > 0) {
      console.log('  ⚠️  page_photos.thumb_url already exists — skip\n');
    } else {
      await conn.query(
        `ALTER TABLE page_photos ADD COLUMN thumb_url VARCHAR(512) NULL AFTER file_path`
      );
      console.log('  ✓ Added page_photos.thumb_url\n');
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
