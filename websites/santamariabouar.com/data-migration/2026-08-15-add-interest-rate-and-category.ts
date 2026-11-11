/**
 * Add "Interest" transaction category and default yearly interest rate (5%).
 *
 * Rollback:
 * DELETE FROM transaction_categories WHERE name = 'Interest';
 * DELETE FROM common_expenses_settings WHERE payment_type = 'yearly_interest_rate';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const CATEGORY_NAME = 'Interest';
const SETTING_TYPE = 'yearly_interest_rate';
const DEFAULT_RATE = 5;

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log(`Adding "${CATEGORY_NAME}" transaction category...`);

  const [existingCategory] = await db.query(
    `SELECT id FROM transaction_categories WHERE LOWER(name) = LOWER(?)`,
    [CATEGORY_NAME]
  );

  if ((existingCategory as any[]).length > 0) {
    ctx.log(`Category already exists (ID: ${(existingCategory as any[])[0].id})`);
  } else {
    const [result] = await db.query(
      `INSERT INTO transaction_categories (name, type, color) VALUES (?, 'income', '#d68910')`,
      [CATEGORY_NAME]
    );
    ctx.log(`Category created with ID: ${(result as any).insertId}`);
  }

  ctx.log(`Ensuring yearly interest rate setting (default ${DEFAULT_RATE}%)...`);

  const [existingSetting] = await db.query(
    `SELECT id FROM common_expenses_settings WHERE payment_type = ? LIMIT 1`,
    [SETTING_TYPE]
  );

  if ((existingSetting as any[]).length > 0) {
    ctx.log(`Yearly interest rate setting already exists (ID: ${(existingSetting as any[])[0].id})`);
    return;
  }

  const [settingResult] = await db.query(
    `INSERT INTO common_expenses_settings (name, amount, year, payment_type)
     VALUES (?, ?, 0, ?)`,
    ['Yearly interest rate', DEFAULT_RATE, SETTING_TYPE]
  );
  ctx.log(`Yearly interest rate setting created with ID: ${(settingResult as any).insertId}`);
}
