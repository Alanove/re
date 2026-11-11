import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';
import {
  STOREFRONT_HEADER_MENU_LEFT,
  STOREFRONT_HEADER_MENU_RIGHT,
} from '../src/constants/storefront-nav-menus';

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: seed storefront header menu roots (Header Left / Header Right)\n');

    const seeds: { title: string; order: number }[] = [
      { title: STOREFRONT_HEADER_MENU_LEFT, order: 100 },
      { title: STOREFRONT_HEADER_MENU_RIGHT, order: 101 },
    ];

    for (const { title, order } of seeds) {
      const [existing] = await conn.query<any[]>(
        `SELECT id FROM menu WHERE parent_id IS NULL AND title = ? LIMIT 1`,
        [title]
      );
      if (existing.length > 0) {
        console.log(`  ⚠️  Root menu "${title}" already exists — skip`);
        continue;
      }
      await conn.query(
        `INSERT INTO menu (title, url, parent_id, order_index, is_visible) VALUES (?, ?, NULL, ?, 1)`,
        [title, '#', order]
      );
      console.log(`  ✓ Created root menu: ${title}`);
    }

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
