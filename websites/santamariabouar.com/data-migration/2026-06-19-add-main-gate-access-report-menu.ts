/**
 * Add Main Gate Access report menu item under Reports
 *
 * Rollback:
 * DELETE FROM admin_menu WHERE url = '/admin/reports/main-gate-access';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding Main Gate Access report menu item...');

  const [reportsRows] = await db.query(`
    SELECT id FROM admin_menu
    WHERE title = 'Reports' AND parent_id IS NULL
    LIMIT 1
  `);

  if ((reportsRows as any[]).length === 0) {
    throw new Error('Reports menu item not found');
  }

  const reportsParentId = (reportsRows as any[])[0].id;

  const [existing] = await db.query(`
    SELECT id FROM admin_menu WHERE url = '/admin/reports/main-gate-access'
  `);

  if ((existing as any[]).length > 0) {
    ctx.log('Main Gate Access report menu item already exists.');
    return;
  }

  const [maxOrder] = await db.query(
    `SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM admin_menu WHERE parent_id = ?`,
    [reportsParentId]
  );

  const [result] = await db.query(
    `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      'Main Gate Access',
      '/admin/reports/main-gate-access',
      reportsParentId,
      (maxOrder as any[])[0].next_order,
      'fa fa-door-open',
      JSON.stringify(['Super Admin', 'Admin', 'Accounting']),
      1
    ]
  );

  ctx.log(`Main Gate Access report menu item created with ID: ${(result as any).insertId}`);
}
