// Load environment variables from .env file
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function up() {
  console.log('Creating newsletter_subscribers table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content_encrypted TEXT NOT NULL COMMENT 'Encrypted email data (JSON)',
      iv VARCHAR(255) NOT NULL COMMENT 'Initialization vector for decryption',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ newsletter_subscribers table ready');
}

async function down() {
  await db.query('DROP TABLE IF EXISTS newsletter_subscribers');
  console.log('  ✓ newsletter_subscribers dropped');
}

async function run() {
  try {
    await up();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
