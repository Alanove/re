import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

async function addColumnIfMissing(
  conn: mysql.PoolConnection,
  column: string,
  ddl: string
): Promise<void> {
  const [cols] = await conn.query<any[]>(`SHOW COLUMNS FROM slider WHERE Field = ?`, [column]);
  if (cols.length > 0) {
    console.log(`  ⚠️  slider.${column} already exists — skip`);
    return;
  }
  await conn.query(ddl);
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
    console.log('\n🔄 Migration: slider media (media_type, video_url, poster_image)\n');

    await addColumnIfMissing(
      conn,
      'media_type',
      `ALTER TABLE slider ADD COLUMN media_type VARCHAR(20) NOT NULL DEFAULT 'image'`
    );
    await addColumnIfMissing(
      conn,
      'video_url',
      `ALTER TABLE slider ADD COLUMN video_url VARCHAR(500) NULL DEFAULT NULL`
    );
    await addColumnIfMissing(
      conn,
      'poster_image',
      `ALTER TABLE slider ADD COLUMN poster_image VARCHAR(500) NULL DEFAULT NULL`
    );

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
