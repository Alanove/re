/**
 * Add is_vacant flag to apartments table.
 *
 * Rollback:
 * ALTER TABLE apartments DROP COLUMN is_vacant;
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows as any[]).length > 0;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding apartments.is_vacant column...');

  if (!(await columnExists('apartments', 'is_vacant'))) {
    await db.query(`
      ALTER TABLE apartments
      ADD COLUMN is_vacant TINYINT(1) NOT NULL DEFAULT 0 AFTER status
    `);
    ctx.log('apartments.is_vacant added.');
  } else {
    ctx.log('apartments.is_vacant already exists, skipping.');
  }
}
