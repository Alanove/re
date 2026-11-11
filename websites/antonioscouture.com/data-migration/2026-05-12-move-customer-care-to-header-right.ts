/**
 * Moves "Customer Care" from Header Left to Header Right (if it was added under Left
 * by an earlier run). Safe if Customer Care is only on Right or absent.
 */
import dotenv from 'dotenv';
import * as path from 'path';
import type { RowDataPacket } from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';
import {
  STOREFRONT_HEADER_MENU_LEFT,
  STOREFRONT_HEADER_MENU_RIGHT,
} from '../src/constants/storefront-nav-menus';
import {
  appendCustomerCareUnderHeaderRightAfterExisting,
  removeCustomerCareUnderHeaderRoot,
} from './helpers/customerCareHeaderMenu';

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: move Customer Care from Header Left to Header Right\n');

    async function rootId(title: string): Promise<number | null> {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM menu WHERE parent_id IS NULL AND title = ? LIMIT 1`,
        [title]
      );
      return rows.length > 0 ? Number(rows[0].id) : null;
    }

    const leftRootId = await rootId(STOREFRONT_HEADER_MENU_LEFT);
    const rightRootId = await rootId(STOREFRONT_HEADER_MENU_RIGHT);
    if (!leftRootId || !rightRootId) {
      throw new Error('Missing Header Left / Header Right menu roots.');
    }

    await removeCustomerCareUnderHeaderRoot(conn, leftRootId);
    console.log('  ✓ Removed Customer Care from Header Left (if it was there)');
    await appendCustomerCareUnderHeaderRightAfterExisting(conn, rightRootId);
    console.log('  ✓ Customer Care ensured under Header Right (skipped if already present)');

    console.log('\n✅ Done. Restart the app or wait for menu cache TTL.\n');
  } finally {
    conn.release();
    await pool.end();
  }
}

export default run;

if (require.main === module) {
  run().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}
