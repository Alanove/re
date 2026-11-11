/**
 * Add the Parking map admin menu just after Apartments.
 * Super Admin only. Bays are drawn on the plan and stored in data/parking-spots.json.
 *
 * Rollback:
 * DELETE FROM admin_menu WHERE url = '/admin/parking-map';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const ROLES = JSON.stringify(['Super Admin']);

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding Parking map menu after Apartments...');

  const url = '/admin/parking-map';
  const [existing] = await db.query(
    `SELECT id FROM admin_menu WHERE url = ? ORDER BY id DESC LIMIT 1`,
    [url]
  );
  const existingId = (existing as Array<{ id: number }>)[0]?.id;

  if (existingId) {
    await db.query(
      `UPDATE admin_menu
       SET title = 'Parking map', parent_id = NULL, icon = 'fa fa-car',
           roles = ?, is_visible = 1, updated_at = NOW()
       WHERE id = ?`,
      [ROLES, existingId]
    );
    ctx.log(`Updated Parking map menu (ID: ${existingId})`);
    return;
  }

  const [apartmentsRows] = await db.query(`
    SELECT id, order_index FROM admin_menu
    WHERE url = '/admin/apartments' AND parent_id IS NULL
    LIMIT 1
  `);
  const apartments = (apartmentsRows as Array<{ id: number; order_index: number }>)[0];
  if (!apartments) {
    throw new Error('Apartments top-level menu item not found');
  }

  const newOrder = Number(apartments.order_index) + 1;
  await db.query(
    `UPDATE admin_menu
     SET order_index = order_index + 1, updated_at = NOW()
     WHERE parent_id IS NULL AND order_index >= ?`,
    [newOrder]
  );

  await db.query(
    `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
     VALUES ('Parking map', ?, NULL, ?, 'fa fa-car', ?, 1, NOW(), NOW())`,
    [url, newOrder, ROLES]
  );
  ctx.log('Created Parking map menu after Apartments.');
}
