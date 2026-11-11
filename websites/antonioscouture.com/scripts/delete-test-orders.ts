/**
 * Script to delete all orders placed by test users.
 * Related rows (order_items, order_status_history, order_shipments,
 * discount_usage, payment_transactions) are removed automatically via ON DELETE CASCADE.
 *
 * Usage:
 *   npx ts-node scripts/delete-test-orders.ts            # delete orders
 *   npx ts-node scripts/delete-test-orders.ts --dry-run  # preview only
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
dotenv.config({ path: envPath });
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import db from '../src/config/database';

const TEST_EMAILS = ['alanove@gmail.com', 'testguest@gmail.com'];

const dryRun = process.argv.includes('--dry-run');

async function main() {
  try {
    const placeholders = TEST_EMAILS.map(() => '?').join(', ');

    // Preview: list matching orders
    const [rowsRaw] = await db.query(
      `SELECT o.id, o.order_number, o.customer_email, o.total_amount, o.status, o.created_at
       FROM orders o
       WHERE o.customer_email IN (${placeholders})
       ORDER BY o.created_at DESC`,
      TEST_EMAILS
    );
    const rows = rowsRaw as any[];

    if (!rows.length) {
      console.log('No orders found for the specified test emails.');
      return;
    }

    console.log(`Found ${rows.length} order(s) for: ${TEST_EMAILS.join(', ')}\n`);
    for (const r of rows) {
      console.log(
        `  #${r.order_number}  id=${r.id}  email=${r.customer_email}  ` +
        `total=${r.total_amount}  status=${r.status}  created=${r.created_at}`
      );
    }

    if (dryRun) {
      console.log('\n[DRY RUN] No changes made.');
      return;
    }

    // Delete – cascades handle child rows automatically
    const [resultRaw] = await db.query(
      `DELETE FROM orders WHERE customer_email IN (${placeholders})`,
      TEST_EMAILS
    );
    const result = resultRaw as any;

    console.log(`\n✓ Deleted ${result.affectedRows} order(s) (and all related rows via CASCADE).`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
