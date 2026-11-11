/**
 * Add "Wallet Adjustment" transaction category used by apartment wallet add/subtract.
 *
 * Rollback:
 * DELETE FROM transaction_categories WHERE name = 'Wallet Adjustment';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

const CATEGORY_NAME = 'Wallet Adjustment';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log(`Adding "${CATEGORY_NAME}" transaction category...`);

  const [existing] = await db.query(
    `SELECT id FROM transaction_categories WHERE LOWER(name) = LOWER(?)`,
    [CATEGORY_NAME]
  );

  if ((existing as any[]).length > 0) {
    ctx.log(`Category already exists (ID: ${(existing as any[])[0].id})`);
    return;
  }

  const [result] = await db.query(
    `INSERT INTO transaction_categories (name, type, color) VALUES (?, 'both', '#20c997')`,
    [CATEGORY_NAME]
  );

  ctx.log(`Category created with ID: ${(result as any).insertId}`);
}
