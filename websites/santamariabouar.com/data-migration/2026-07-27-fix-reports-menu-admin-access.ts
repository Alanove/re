/**
 * Grant Admin role access to the Reports parent menu item.
 *
 * The Reports folder uses url "javascript:;" so the previous role migration
 * left it as Super Admin only, hiding all report children from Admin users.
 *
 * Rollback:
 * UPDATE admin_menu SET roles = '["Super Admin"]' WHERE title = 'Reports' AND parent_id IS NULL;
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Granting Admin access to Reports menu parent...');

  const adminView = JSON.stringify(['Super Admin', 'Admin']);

  const [result] = await db.query(
    `UPDATE admin_menu
     SET roles = ?, updated_at = NOW()
     WHERE parent_id IS NULL
       AND (
         title = 'Reports'
         OR url LIKE '/admin/reports%'
         OR url = 'javascript:;'
       )
       AND title LIKE '%Report%'`,
    [adminView]
  );

  // Also ensure all report children allow Admin
  await db.query(
    `UPDATE admin_menu
     SET roles = ?, updated_at = NOW()
     WHERE url LIKE '/admin/reports%'
        OR url LIKE '/admin/transactions/report%'
        OR url = '/admin/common-expenses/unpaid-report'`,
    [adminView]
  );

  ctx.log(`Updated Reports parent rows: ${(result as any).affectedRows || 0}`);
}
