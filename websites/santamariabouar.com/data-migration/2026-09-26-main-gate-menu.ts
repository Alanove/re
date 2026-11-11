/**
 * Group main-gate admin pages under a Main Gate parent menu.
 *
 * Rollback:
 * UPDATE admin_menu SET parent_id = NULL
 *   WHERE url IN ('/admin/main-gate-access', '/admin/gate-open-log');
 * UPDATE admin_menu
 *   SET parent_id = (SELECT id FROM (SELECT id FROM admin_menu WHERE title = 'Member Portal' AND url = '#' LIMIT 1) t)
 *   WHERE url = '/admin/gate-access-requests';
 * DELETE FROM admin_menu WHERE url = '/admin/main-gate/safemate';
 * DELETE FROM admin_menu WHERE title = 'Main Gate' AND url = '#'
 *   AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM admin_menu WHERE parent_id = (
 *     SELECT id FROM admin_menu WHERE title = 'Main Gate' AND url = '#' LIMIT 1
 *   )) c);
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const PARENT_ROLES = JSON.stringify(['Super Admin', 'Admin']);
const SAFEMATE_ROLES = JSON.stringify(['Super Admin']);

async function findParentId(): Promise<number | null> {
  const [rows] = await db.query(
    `SELECT id FROM admin_menu WHERE title = 'Main Gate' AND url = '#' ORDER BY id DESC LIMIT 1`
  );
  const id = (rows as Array<{ id: number }>)[0]?.id;
  return id ? Number(id) : null;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Grouping main gate admin menus under Main Gate...');

  let parentId = await findParentId();
  if (!parentId) {
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
    parentId = Number((result as unknown as { insertId: number }).insertId);
    ctx.log(`Created Main Gate parent menu (ID: ${parentId})`);
  } else {
    await db.query(
      `UPDATE admin_menu
       SET icon = 'fa fa-door-open', roles = ?, is_visible = 1, parent_id = NULL, updated_at = NOW()
       WHERE id = ?`,
      [PARENT_ROLES, parentId]
    );
    ctx.log(`Main Gate parent already exists (ID: ${parentId})`);
  }

  const children: Array<{ url: string; title: string; icon: string; roles: string; order: number }> = [
    {
      url: '/admin/main-gate-access',
      title: 'Main Gate Access',
      icon: 'fa fa-list',
      roles: PARENT_ROLES,
      order: 1
    },
    {
      url: '/admin/gate-access-requests',
      title: 'Gate Access Requests',
      icon: 'fa fa-key',
      roles: PARENT_ROLES,
      order: 2
    },
    {
      url: '/admin/gate-open-log',
      title: 'Gate Open Log',
      icon: 'fa fa-history',
      roles: PARENT_ROLES,
      order: 3
    },
    {
      url: '/admin/main-gate/safemate',
      title: 'SafeMate Users',
      icon: 'fa fa-mobile-alt',
      roles: SAFEMATE_ROLES,
      order: 4
    }
  ];

  for (const child of children) {
    const [existing] = await db.query(`SELECT id FROM admin_menu WHERE url = ? ORDER BY id DESC LIMIT 1`, [
      child.url
    ]);
    const existingId = (existing as Array<{ id: number }>)[0]?.id;
    if (existingId) {
      await db.query(
        `UPDATE admin_menu
         SET title = ?, parent_id = ?, order_index = ?, icon = ?, roles = ?, is_visible = 1, updated_at = NOW()
         WHERE id = ?`,
        [child.title, parentId, child.order, child.icon, child.roles, existingId]
      );
      ctx.log(`Moved ${child.title} under Main Gate`);
    } else {
      await db.query(
        `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [child.title, child.url, parentId, child.order, child.icon, child.roles]
      );
      ctx.log(`Created ${child.title} under Main Gate`);
    }
  }

  ctx.log('Main Gate menu group is ready.');
}
