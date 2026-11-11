/**
 * Uses the same MySQL config as the app (src/config/database.config.ts).
 * Run: npx ts-node admin/scripts/investigate-credits-invoices.ts
 * Optional: TRANSACTION_ID=235 APARTMENT_ID=28 INVOICE_ID=283
 */
import { db } from '../../src/config/database';
import { dbConfig } from '../../src/config/database.config';

const TXN = parseInt(process.env.TRANSACTION_ID || '235', 10);
const APT = parseInt(process.env.APARTMENT_ID || '28', 10);
const INV = parseInt(process.env.INVOICE_ID || '283', 10);

function section(title: string) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

async function run() {
  const env = process.env.NODE_ENV || 'development';
  section('Active DB config (same as app)');
  console.log(`NODE_ENV: ${env}`);
  console.log(`host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`database name: ${dbConfig.database}`);
  console.log(`user: ${dbConfig.user}`);

  section('Row counts');
  for (const [label, sql] of [
    ['invoices', 'SELECT COUNT(*) AS c FROM invoices'],
    ['invoice_transactions', 'SELECT COUNT(*) AS c FROM invoice_transactions'],
    ['transactions', 'SELECT COUNT(*) AS c FROM transactions'],
    ['apartments', 'SELECT COUNT(*) AS c FROM apartments']
  ] as const) {
    const [rows] = await db.query(sql);
    console.log(`${label}: ${(rows as any[])[0]?.c}`);
  }

  section(`Transaction id=${TXN} (Credit - Owner check)`);
  const [txnRows] = await db.query(
    `SELECT t.id, t.amount, t.apartment_id, t.category_id, t.description, t.date,
            tc.name AS category_name
     FROM transactions t
     LEFT JOIN transaction_categories tc ON tc.id = t.category_id
     WHERE t.id = ?`,
    [TXN]
  );
  console.log(JSON.stringify(txnRows, null, 2));

  section(`Invoice id=${INV} (exists?)`);
  const [invRows] = await db.query(`SELECT * FROM invoices WHERE id = ?`, [INV]);
  console.log(invRows && (invRows as any[]).length ? JSON.stringify(invRows, null, 2) : '(no row)');

  section(`Invoices for apartment_id=${APT}`);
  const [aptInv] = await db.query(
    `SELECT id, apartment_id, amount, description, invoice_date, year
     FROM invoices WHERE apartment_id = ? ORDER BY id DESC`,
    [APT]
  );
  console.log(JSON.stringify(aptInv, null, 2));

  section(`invoice_transactions WHERE invoice_id=${INV}`);
  const [itInv] = await db.query(
    `SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
     FROM invoice_transactions WHERE invoice_id = ? ORDER BY id`,
    [INV]
  );
  console.log(JSON.stringify(itInv, null, 2));

  section(`invoice_transactions WHERE transaction_id=${TXN}`);
  const [itTxn] = await db.query(
    `SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
     FROM invoice_transactions WHERE transaction_id = ? ORDER BY id`,
    [TXN]
  );
  console.log(JSON.stringify(itTxn, null, 2));

  section(`invoice_transactions WHERE apartment_id=${APT} (last 30)`);
  const [itApt] = await db.query(
    `SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
     FROM invoice_transactions WHERE apartment_id = ? ORDER BY id DESC LIMIT 30`,
    [APT]
  );
  console.log(JSON.stringify(itApt, null, 2));

  section('Recent invoices (highest ids, last 15)');
  const [recent] = await db.query(
    `SELECT id, apartment_id, amount, description FROM invoices ORDER BY id DESC LIMIT 15`
  );
  console.log(JSON.stringify(recent, null, 2));

  section('Credit - Owner transactions (last 10)');
  const [co] = await db.query(
    `SELECT t.id, t.amount, t.apartment_id, t.description, t.date
     FROM transactions t
     INNER JOIN transaction_categories tc ON tc.id = t.category_id
     WHERE tc.name = 'Credit - Owner'
     ORDER BY t.id DESC LIMIT 10`
  );
  console.log(JSON.stringify(co, null, 2));

  console.log('\nDone.\n');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
