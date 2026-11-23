/**
 * Admin login selects users.language. Add the column when missing.
 */
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
    const [cols] = await conn.query<any[]>(
      `SHOW COLUMNS FROM users WHERE Field = ?`,
      ['language']
    );
    if (cols.length > 0) {
      console.log('users.language already exists — skip');
    } else {
      await conn.query(
        `ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER role`
      );
      console.log('Added users.language');
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

export default run;

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
