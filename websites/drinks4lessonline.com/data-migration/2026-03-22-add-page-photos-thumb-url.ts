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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS page_photos (
        id INT NOT NULL AUTO_INCREMENT,
        page_id INT NOT NULL,
        filename VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_page_id (page_id),
        CONSTRAINT page_photos_ibfk_1 FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
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
