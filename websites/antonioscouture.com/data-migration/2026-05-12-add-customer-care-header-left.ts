/**
 * Adds a "Customer Care" mega-menu item under Header Right with:
 * Request Appointment → /contact-us?subject=appointment
 * Client Services → /contact-us
 * Wedding Dress Rental → /shop/category/wedding-dress-rental
 * Live Chat → /contact-us?subject=Live%20Chat
 *
 * (Filename kept for migration history; targets Header Right.)
 *
 * Idempotent: skips if a top-level "Customer Care" item already exists under Header Right.
 */
import dotenv from 'dotenv';
import * as path from 'path';
import type { RowDataPacket } from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';
import { STOREFRONT_HEADER_MENU_RIGHT } from '../src/constants/storefront-nav-menus';
import { appendCustomerCareUnderHeaderRightAfterExisting } from './helpers/customerCareHeaderMenu';

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: add Customer Care under Header Right\n');

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM menu WHERE parent_id IS NULL AND title = ? LIMIT 1`,
      [STOREFRONT_HEADER_MENU_RIGHT]
    );
    if (rows.length === 0) {
      throw new Error(`Missing "${STOREFRONT_HEADER_MENU_RIGHT}" menu root. Run seed migration for header menus first.`);
    }
    const rightRootId = Number(rows[0].id);

    await appendCustomerCareUnderHeaderRightAfterExisting(conn, rightRootId);

    console.log('  ✓ Customer Care menu ensured under Header Right (skipped if already present)');
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
