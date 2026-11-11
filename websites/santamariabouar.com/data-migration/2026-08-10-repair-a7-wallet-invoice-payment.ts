/**
 * Repair wallet ledger for apartment A7 after invoice payment mutated the top-up row.
 *
 * Before: top-up row #247 reduced 250 → 120; allocation #298 ($130) created for invoice 319.
 * After:  restore top-up to $250; add -$130 wallet outflow line so payment appears on statement.
 * Balance stays $56 (250 - 130 - 8 - 56).
 *
 * Rollback:
 *   DELETE FROM invoice_transactions WHERE id = <new_negative_id>;
 *   DELETE FROM transactions WHERE id = <memo_tx_id>;
 *   UPDATE invoice_transactions SET amount = 120 WHERE id = 247;
 */
require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.development' });
const db = require('../src/config/database').default;

(async () => {
  const APT_ID = 8;
  const TOPUP_ROW_ID = 247;
  const ALLOCATION_ID = 298;
  const ORIGINAL_TOPUP = 250;
  const PAYMENT_AMOUNT = 130;

  const [topupRows] = await db.query(
    `SELECT id, apartment_id, invoice_id, amount, transaction_id FROM invoice_transactions WHERE id = ?`,
    [TOPUP_ROW_ID]
  );
  const topup = (topupRows as any[])[0];
  if (!topup || topup.apartment_id !== APT_ID) {
    throw new Error(`Expected top-up row ${TOPUP_ROW_ID} for apartment ${APT_ID}`);
  }

  const [allocRows] = await db.query(
    `SELECT id, apartment_id, invoice_id, amount, transaction_id, created_at
     FROM invoice_transactions WHERE id = ?`,
    [ALLOCATION_ID]
  );
  const alloc = (allocRows as any[])[0];
  if (!alloc || Number(alloc.amount) !== PAYMENT_AMOUNT) {
    throw new Error(`Expected allocation row ${ALLOCATION_ID} for $${PAYMENT_AMOUNT}`);
  }

  const [invoiceRows] = await db.query(
    `SELECT id, description FROM invoices WHERE id = ?`,
    [alloc.invoice_id]
  );
  const invoice = (invoiceRows as any[])[0];
  const invoiceLabel = invoice?.description || `Invoice #${alloc.invoice_id}`;

  // Already repaired?
  const [existing] = await db.query(
    `
    SELECT it.id
    FROM invoice_transactions it
    INNER JOIN transactions t ON t.id = it.transaction_id
    WHERE it.apartment_id = ?
      AND it.invoice_id IS NULL
      AND it.amount = ?
      AND t.description LIKE ?
    LIMIT 1
  `,
    [APT_ID, -PAYMENT_AMOUNT, `Wallet payment — ${invoiceLabel}%`]
  );
  if ((existing as any[]).length) {
    console.log('Repair already applied; ensuring top-up amount is restored...');
    await db.query(`UPDATE invoice_transactions SET amount = ? WHERE id = ? AND invoice_id IS NULL`, [
      ORIGINAL_TOPUP,
      TOPUP_ROW_ID
    ]);
    await db.close();
    process.exit(0);
  }

  const currentAmount = parseFloat(String(topup.amount));
  if (Math.abs(currentAmount - (ORIGINAL_TOPUP - PAYMENT_AMOUNT)) > 0.009 &&
      Math.abs(currentAmount - ORIGINAL_TOPUP) > 0.009) {
    console.warn(`Unexpected top-up amount ${currentAmount}; continuing with repair to ${ORIGINAL_TOPUP}`);
  }

  const [catRows] = await db.query(
    `SELECT id FROM transaction_categories WHERE LOWER(name) = LOWER('Wallet Adjustment') LIMIT 1`
  );
  const categoryId = (catRows as any[])[0]?.id;
  if (!categoryId) {
    throw new Error('Wallet Adjustment category not found');
  }

  const [acctRows] = await db.query(
    `SELECT account_id FROM transactions WHERE id = ?`,
    [topup.transaction_id]
  );
  let accountId = (acctRows as any[])[0]?.account_id;
  if (!accountId) {
    const [fallback] = await db.query(`SELECT id FROM accounts WHERE is_active = 1 ORDER BY id LIMIT 1`);
    accountId = (fallback as any[])[0]?.id;
  }
  if (!accountId) {
    throw new Error('No account found for memo transaction');
  }

  const created = alloc.created_at instanceof Date ? alloc.created_at : new Date(alloc.created_at);
  const paymentDate = created.toISOString().slice(0, 10);
  const createdAtSql = created.toISOString().slice(0, 19).replace('T', ' ');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`UPDATE invoice_transactions SET amount = ? WHERE id = ? AND invoice_id IS NULL`, [
      ORIGINAL_TOPUP,
      TOPUP_ROW_ID
    ]);

    const [txResult] = await conn.query(
      `
      INSERT INTO transactions
        (amount, type, category_id, description, date, account_id, apartment_id, invoice_id, reference, created_by, receipt_generated, receipt_image)
      VALUES (?, 'expense', ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, NULL)
    `,
      [0, categoryId, `Wallet payment — ${invoiceLabel}`, paymentDate, accountId, APT_ID]
    );
    const memoTxId = (txResult as any).insertId;

    await conn.query(
      `
      INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount, created_at)
      VALUES (NULL, ?, ?, ?, ?)
    `,
      [memoTxId, APT_ID, -PAYMENT_AMOUNT, createdAtSql]
    );

    await conn.commit();
    console.log(`Repaired A7 wallet: top-up #${TOPUP_ROW_ID}=$${ORIGINAL_TOPUP}, memo tx #${memoTxId}, outflow -$${PAYMENT_AMOUNT}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const [sum] = await db.query(
    `
    SELECT COALESCE(SUM(amount), 0) as balance
    FROM invoice_transactions
    WHERE apartment_id = ? AND invoice_id IS NULL
  `,
    [APT_ID]
  );
  console.log('Wallet balance now:', (sum as any[])[0]?.balance);

  await db.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
