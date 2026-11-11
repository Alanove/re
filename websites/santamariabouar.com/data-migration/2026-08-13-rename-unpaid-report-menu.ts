/**
 * Rename Reports submenu item from "Unpaid Common Expenses" to "Unpaid Invoices".
 * URL stays /admin/reports/unpaid-report.
 *
 * Rollback:
 * UPDATE admin_menu SET title = 'Unpaid Common Expenses'
 * WHERE url = '/admin/reports/unpaid-report';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Renaming unpaid report menu item to Unpaid Invoices...');

  const [rows] = await db.query(
    `SELECT id, title FROM admin_menu WHERE url = '/admin/reports/unpaid-report' LIMIT 1`
  );
  const items = rows as Array<{ id: number; title: string }>;

  if (items.length === 0) {
    ctx.log('No menu item found for /admin/reports/unpaid-report — skipping');
    return;
  }

  if (items[0].title === 'Unpaid Invoices') {
    ctx.log(`Menu item already titled Unpaid Invoices (ID: ${items[0].id})`);
    return;
  }

  await db.query(
    `UPDATE admin_menu SET title = ?, updated_at = NOW() WHERE id = ?`,
    ['Unpaid Invoices', items[0].id]
  );
  ctx.log(`Updated menu item ID ${items[0].id} from "${items[0].title}" to "Unpaid Invoices"`);
}
