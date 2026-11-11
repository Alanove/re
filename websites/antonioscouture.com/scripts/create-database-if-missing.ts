/**
 * Creates DB_NAME from .env.<NODE_ENV> if it does not exist (MySQL).
 * Usage: NODE_ENV=development npx ts-node scripts/create-database-if-missing.ts
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import * as path from 'path';

async function main(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const name = process.env.DB_NAME || 'povdorie-beirut';
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await c.query(
      'CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
      [name]
    );
    console.log('Database ready:', name);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
