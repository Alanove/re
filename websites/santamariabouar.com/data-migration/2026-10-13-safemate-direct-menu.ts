/**
 * Add the SafeMate Direct admin menu under Main Gate.
 * Super Admin only. The page talks to the SafeMate cloud and does not change CMS data.
 *
 * Rollback:
 * DELETE FROM admin_menu WHERE url = '/admin/safemate-direct';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const SAFEMATE_ROLES = JSON.stringify(['Super Admin']);
const PARENT_ROLES = JSON.stringify(['Super Admin', 'Admin']);

async function ensureParentId(ctx: MigrationContext): Promise<number> {
  const [parents] = await db.query(
    `SELECT id FROM admin_menu WHERE title = 'Main Gate' AND url = '#' ORDER BY id DESC LIMIT 1`
  );
  const existingId = (parents as Array<{ id: number }>)[0]?.id;
  if (existingId) {
    return Number(existingId);
  }

  const [anchorRows] = await db.query(
    `SELECT order_index FROM admin_menu WHERE url = '/admin/main-gate-access' ORDER BY id DESC LIMIT 1`
  );
  const anchorOrder = (anchorRows as Array<{ order_index: number }>)[0]?.order_index;
  const orderIndex = anchorOrder != null ? Number(anchorOrder) : 50;

  const [result] = await db.query(
    `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
     VALUES ('Main Gate', '#', NULL, ?, 'fa fa-door-open', ?, 1, NOW(), NOW())`,
    [orderIndex, PARENT_ROLES]
  );
  const parentId = Number((result as unknown as { insertId: number }).insertId);
  ctx.log(`Created Main Gate parent menu (ID: ${parentId})`);
  return parentId;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding SafeMate Direct menu under Main Gate...');

  const parentId = await ensureParentId(ctx);

  const url = '/admin/safemate-direct';
  const [existing] = await db.query(`SELECT id FROM admin_menu WHERE url = ? ORDER BY id DESC LIMIT 1`, [url]);
  const existingId = (existing as Array<{ id: number }>)[0]?.id;

  if (existingId) {
    await db.query(
      `UPDATE admin_menu
       SET title = 'SafeMate Direct', parent_id = ?, order_index = 5, icon = 'fa fa-wrench',
           roles = ?, is_visible = 1, updated_at = NOW()
       WHERE id = ?`,
      [parentId, SAFEMATE_ROLES, existingId]
    );
    ctx.log(`Updated SafeMate Direct menu (ID: ${existingId})`);
    return;
  }

  await db.query(
    `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
     VALUES ('SafeMate Direct', ?, ?, 5, 'fa fa-wrench', ?, 1, NOW(), NOW())`,
    [url, parentId, SAFEMATE_ROLES]
  );
  ctx.log('Created SafeMate Direct menu under Main Gate.');
}
