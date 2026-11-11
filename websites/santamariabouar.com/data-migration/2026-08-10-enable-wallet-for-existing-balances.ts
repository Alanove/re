/**
 * Enable member-portal wallet access for users linked to apartments
 * that already have unallocated wallet credits (invoice_id IS NULL).
 *
 * Fixes empty /account/wallet when money exists but users.wallet_enabled = 0.
 *
 * Rollback:
 *   UPDATE users SET wallet_enabled = 0 WHERE id IN (...ids enabled by this script...);
 *   (prefer restoring from backup if unsure)
 */
require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.development' });
const db = require('../src/config/database').default;

(async () => {
  console.log('Enabling wallet for members with existing wallet balances...');

  const [before] = await db.query(`
    SELECT u.id, u.username, u.wallet_enabled
    FROM users u
    WHERE u.wallet_enabled = 0
      AND (
        u.id IN (
          SELECT au.user_id
          FROM apartment_users au
          WHERE au.apartment_id IN (
            SELECT apartment_id
            FROM invoice_transactions
            WHERE invoice_id IS NULL
            GROUP BY apartment_id
            HAVING ABS(SUM(amount)) > 0.009
          )
        )
        OR u.id IN (
          SELECT a.owner_id
          FROM apartments a
          WHERE a.owner_id IS NOT NULL
            AND a.id IN (
              SELECT apartment_id
              FROM invoice_transactions
              WHERE invoice_id IS NULL
              GROUP BY apartment_id
              HAVING ABS(SUM(amount)) > 0.009
            )
        )
        OR u.id IN (
          SELECT a.renter_id
          FROM apartments a
          WHERE a.renter_id IS NOT NULL
            AND a.id IN (
              SELECT apartment_id
              FROM invoice_transactions
              WHERE invoice_id IS NULL
              GROUP BY apartment_id
              HAVING ABS(SUM(amount)) > 0.009
            )
        )
      )
    ORDER BY u.id
  `);

  console.log('Users to enable:', JSON.stringify(before, null, 2));

  const [result] = await db.query(`
    UPDATE users u
    SET u.wallet_enabled = 1
    WHERE u.wallet_enabled = 0
      AND (
        u.id IN (
          SELECT au.user_id
          FROM apartment_users au
          WHERE au.apartment_id IN (
            SELECT apartment_id
            FROM invoice_transactions
            WHERE invoice_id IS NULL
            GROUP BY apartment_id
            HAVING ABS(SUM(amount)) > 0.009
          )
        )
        OR u.id IN (
          SELECT a.owner_id
          FROM apartments a
          WHERE a.owner_id IS NOT NULL
            AND a.id IN (
              SELECT apartment_id
              FROM invoice_transactions
              WHERE invoice_id IS NULL
              GROUP BY apartment_id
              HAVING ABS(SUM(amount)) > 0.009
            )
        )
        OR u.id IN (
          SELECT a.renter_id
          FROM apartments a
          WHERE a.renter_id IS NOT NULL
            AND a.id IN (
              SELECT apartment_id
              FROM invoice_transactions
              WHERE invoice_id IS NULL
              GROUP BY apartment_id
              HAVING ABS(SUM(amount)) > 0.009
            )
        )
      )
  `);

  console.log('Updated rows:', (result as any).affectedRows);
  await db.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
