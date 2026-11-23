import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

async function addColumn(conn: mysql.PoolConnection, column: string, definition: string): Promise<void> {
  const [cols] = await conn.query<any[]>(
    `SHOW COLUMNS FROM slider WHERE Field = ?`,
    [column]
  );
  if (cols.length > 0) {
    console.log(`  ⚠️  slider.${column} already exists — skip`);
    return;
  }
  await conn.query(`ALTER TABLE slider ADD COLUMN ${column} ${definition}`);
  console.log(`  ✓ Added slider.${column}`);
}

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: slider mobile image and video\n');
    const [posterCols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM slider WHERE Field = 'poster_image'`
    );
    const imageAfter = posterCols.length > 0 ? ' AFTER poster_image' : '';
    await addColumn(conn, 'mobile_image_url', `VARCHAR(500) NULL${imageAfter}`);
    const [mobileImageCols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM slider WHERE Field = 'mobile_image_url'`
    );
    const videoAfter = mobileImageCols.length > 0 ? ' AFTER mobile_image_url' : '';
    await addColumn(conn, 'mobile_video_url', `VARCHAR(500) NULL${videoAfter}`);
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
