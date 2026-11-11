/**
 * Add Apartment Wallets menu item under Accounting
 *
 * Rollback:
 * DELETE FROM admin_menu WHERE url = '/admin/wallets';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding Apartment Wallets menu item...');

  const [accountingRows] = await db.query(`
    SELECT id FROM admin_menu
    WHERE url = '#' AND title LIKE '%Accounting%'
    LIMIT 1
  `);

  if ((accountingRows as any[]).length === 0) {
    throw new Error('Accounting menu item not found');
  }

  const accountingParentId = (accountingRows as any[])[0].id;
  ctx.log(`Found Accounting menu with ID: ${accountingParentId}`);

  const [existing] = await db.query(`
    SELECT id FROM admin_menu WHERE url = '/admin/wallets'
  `);

  if ((existing as any[]).length > 0) {
    ctx.log(`Apartment Wallets menu item already exists (ID: ${(existing as any[])[0].id})`);
    return;
  }

  const [maxOrder] = await db.query(
    `SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM admin_menu WHERE parent_id = ?`,
    [accountingParentId]
  );

  const [result] = await db.query(
    `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      'Apartment Wallets',
      '/admin/wallets',
      accountingParentId,
      (maxOrder as any[])[0].next_order,
      'fa fa-wallet',
      JSON.stringify(['Super Admin', 'Admin', 'Accounting']),
      1
    ]
  );

  ctx.log(`Apartment Wallets menu item created with ID: ${(result as any).insertId}`);
}
