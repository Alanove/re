/**
 * Add last_login to users so admin can see when each account last signed in.
 * Idempotent: safe if the column was already added outside the migration runner.
 *
 * Rollback:
 * ALTER TABLE users DROP COLUMN last_login;
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
  ctx.log('Adding users.last_login...');

  if (!(await columnExists('users', 'last_login'))) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN last_login DATETIME NULL AFTER updated_at
    `);
    ctx.log('users.last_login added.');
  } else {
    ctx.log('users.last_login already exists, skipping.');
  }
}
