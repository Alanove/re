/**
 * Applies src/database/schema.sql to DB_NAME (CMS core tables: users, pages, etc.).
 * Required before `npm run migrate` on an empty database (e-commerce migrations FK to users).
 *
 * Uses multipleStatements; the file includes DROP TABLE IF EXISTS then CREATE.
 *
 * Usage: npx ts-node scripts/apply-base-schema.ts
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const sqlPath = path.resolve(process.cwd(), 'src/database/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const name = process.env.DB_NAME || 'povdorie-beirut';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: name,
    multipleStatements: true,
  });

  try {
    console.log('Applying base schema from', sqlPath);
    await conn.query(sql);
    console.log('Base schema applied.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
