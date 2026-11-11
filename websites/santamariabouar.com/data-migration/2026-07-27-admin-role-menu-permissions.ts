/**
 * Restrict admin_menu roles for Admin read-only access.
 *
 * Super Admin keeps full menu visibility.
 * Admin only sees Dashboard, Apartments, Users, Reports (and Profile if present).
 * Content Manager / Accounting menu entries are Super Admin only (those roles
 * can no longer log into the admin portal).
 *
 * Rollback:
 * Restore previous roles JSON from backup, or re-run earlier menu migrations.
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const SUPER_ADMIN_ONLY = JSON.stringify(['Super Admin']);
const ADMIN_VIEW = JSON.stringify(['Super Admin', 'Admin']);

const ADMIN_VIEW_URL_PREFIXES = [
  '/admin/dashboard',
  '/admin/apartments',
  '/admin/users',
  '/admin/reports',
  '/admin/profile',
  '/admin/transactions/report',
  '/admin/common-expenses/unpaid-report'
];

function isAdminViewUrl(url: string | null): boolean {
  if (!url || url === '#') {
    return false;
  }
  return ADMIN_VIEW_URL_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?')
  );
}

function isAdminViewParentTitle(title: string | null): boolean {
  if (!title) return false;
  const normalized = title.toLowerCase();
  return (
    normalized.includes('report') ||
    normalized.includes('apartment') ||
    normalized.includes('user') ||
    normalized === 'dashboard' ||
    normalized.includes('profile')
  );
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Updating admin_menu roles for Super Admin / Admin read-only split...');

  const [rows] = await db.query(
    `SELECT id, title, url, parent_id, roles FROM admin_menu`
  );

  const items = rows as Array<{
    id: number;
    title: string;
    url: string | null;
    parent_id: number | null;
    roles: string | null;
  }>;

  const byId = new Map(items.map((item) => [item.id, item]));

  let updated = 0;

  for (const item of items) {
    let nextRoles = SUPER_ADMIN_ONLY;

    if (isAdminViewUrl(item.url)) {
      nextRoles = ADMIN_VIEW;
    } else if ((!item.url || item.url === '#') && isAdminViewParentTitle(item.title)) {
      // Parent folders for viewable sections stay visible to Admin
      nextRoles = ADMIN_VIEW;
    } else if (item.parent_id) {
      const parent = byId.get(item.parent_id);
      if (parent && isAdminViewUrl(item.url)) {
        nextRoles = ADMIN_VIEW;
      }
    }

    // Dashboard / home links without matching prefix
    if (item.url === '/admin' || item.url === '/admin/') {
      nextRoles = ADMIN_VIEW;
    }

    await db.query(`UPDATE admin_menu SET roles = ?, updated_at = NOW() WHERE id = ?`, [
      nextRoles,
      item.id
    ]);
    updated += 1;
  }

  // Ensure report children under a Reports parent keep Admin access
  const [reportParents] = await db.query(
    `SELECT id FROM admin_menu WHERE title LIKE '%Report%' AND (url = '#' OR url IS NULL OR url = '')`
  );
  for (const parent of reportParents as Array<{ id: number }>) {
    await db.query(
      `UPDATE admin_menu SET roles = ?, updated_at = NOW() WHERE id = ? OR parent_id = ?`,
      [ADMIN_VIEW, parent.id, parent.id]
    );
  }

  // Ensure apartments / users top-level and children keep Admin access
  await db.query(
    `UPDATE admin_menu SET roles = ?, updated_at = NOW()
     WHERE url LIKE '/admin/apartments%'
        OR url LIKE '/admin/users%'
        OR url LIKE '/admin/reports%'
        OR url LIKE '/admin/dashboard%'
        OR url LIKE '/admin/profile%'
        OR url LIKE '/admin/transactions/report%'
        OR url = '/admin/common-expenses/unpaid-report'`,
    [ADMIN_VIEW]
  );

  // Explicitly Super Admin only for member portal & finance areas Admin must not see
  await db.query(
    `UPDATE admin_menu SET roles = ?, updated_at = NOW()
     WHERE url LIKE '/admin/access-requests%'
        OR url LIKE '/admin/listing-requests%'
        OR url LIKE '/admin/gate-access-requests%'
        OR url LIKE '/admin/photo-approvals%'
        OR url LIKE '/admin/wallets%'
        OR url LIKE '/admin/invoices%'
        OR url LIKE '/admin/payments%'
        OR url LIKE '/admin/accounts%'
        OR url LIKE '/admin/transactions%'
        OR url LIKE '/admin/transaction-categories%'
        OR url LIKE '/admin/common-expenses%'
        OR url LIKE '/admin/pages%'
        OR url LIKE '/admin/slider%'
        OR url LIKE '/admin/projects%'
        OR url LIKE '/admin/menus%'
        OR url LIKE '/admin/site-settings%'
        OR url LIKE '/admin/theme%'
        OR title = 'Member Portal'
        OR title LIKE '%Accounting%'
        OR title LIKE '%Content%'`,
    [SUPER_ADMIN_ONLY]
  );

  // Re-apply Admin view for report URLs that the finance block may have overwritten
  await db.query(
    `UPDATE admin_menu SET roles = ?, updated_at = NOW()
     WHERE url LIKE '/admin/reports%'
        OR url LIKE '/admin/transactions/report%'
        OR url = '/admin/common-expenses/unpaid-report'
        OR (parent_id IS NULL AND title = 'Reports')`,
    [ADMIN_VIEW]
  );

  ctx.log(`Updated roles on ${updated} admin_menu rows.`);
}
