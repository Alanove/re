/**
 * Promote Main Gate Access from Reports submenu to its own top-level menu section.
 *
 * Rollback:
 * UPDATE admin_menu
 * SET url = '/admin/reports/main-gate-access',
 *     parent_id = (SELECT id FROM (SELECT id FROM admin_menu WHERE title = 'Reports' AND parent_id IS NULL LIMIT 1) t),
 *     title = 'Main Gate Access'
 * WHERE url = '/admin/main-gate-access';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Promoting Main Gate Access menu item to its own section...');

  const [apartmentsRows] = await db.query(`
    SELECT id, order_index FROM admin_menu
    WHERE url = '/admin/apartments' AND parent_id IS NULL
    LIMIT 1
  `);

  if ((apartmentsRows as any[]).length === 0) {
    throw new Error('Apartments top-level menu item not found');
  }

  const apartmentsOrder = (apartmentsRows as any[])[0].order_index;
  const newOrder = apartmentsOrder + 1;

  // Make room after Apartments for the new top-level item
  await db.query(
    `UPDATE admin_menu
     SET order_index = order_index + 1, updated_at = NOW()
     WHERE parent_id IS NULL AND order_index >= ?`,
    [newOrder]
  );

  const [existingNew] = await db.query(`
    SELECT id FROM admin_menu WHERE url = '/admin/main-gate-access' LIMIT 1
  `);

  if ((existingNew as any[]).length > 0) {
    await db.query(
      `UPDATE admin_menu
       SET title = ?, parent_id = NULL, order_index = ?, icon = ?, roles = ?, is_visible = 1, updated_at = NOW()
       WHERE id = ?`,
      [
        'Main Gate Access',
        newOrder,
        'fa fa-door-open',
        JSON.stringify(['Super Admin', 'Admin']),
        (existingNew as any[])[0].id
      ]
    );
    ctx.log(`Updated existing Main Gate Access menu item (ID: ${(existingNew as any[])[0].id})`);
  } else {
    const [existingOld] = await db.query(`
      SELECT id FROM admin_menu WHERE url = '/admin/reports/main-gate-access' LIMIT 1
    `);

    if ((existingOld as any[]).length > 0) {
      await db.query(
        `UPDATE admin_menu
         SET title = ?, url = ?, parent_id = NULL, order_index = ?, icon = ?, roles = ?, is_visible = 1, updated_at = NOW()
         WHERE id = ?`,
        [
          'Main Gate Access',
          '/admin/main-gate-access',
          newOrder,
          'fa fa-door-open',
          JSON.stringify(['Super Admin', 'Admin']),
          (existingOld as any[])[0].id
        ]
      );
      ctx.log(`Moved Main Gate Access menu item out of Reports (ID: ${(existingOld as any[])[0].id})`);
    } else {
      const [result] = await db.query(
        `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, 1, NOW(), NOW())`,
        [
          'Main Gate Access',
          '/admin/main-gate-access',
          newOrder,
          'fa fa-door-open',
          JSON.stringify(['Super Admin', 'Admin'])
        ]
      );
      ctx.log(`Created Main Gate Access menu item with ID: ${(result as any).insertId}`);
    }
  }

  // Clean up any leftover report URL entry if both somehow exist
  await db.query(`
    DELETE FROM admin_menu
    WHERE url = '/admin/reports/main-gate-access'
  `);

  ctx.log('Main Gate Access is now a top-level admin section.');
}
