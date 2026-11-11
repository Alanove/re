/**
 * Add role (owner/tenant) to access_request_apartments
 *
 * Rollback:
 * ALTER TABLE access_request_apartments DROP COLUMN role;
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
  ctx.log('Adding role column to access_request_apartments...');

  if (!(await columnExists('access_request_apartments', 'role'))) {
    await db.query(`
      ALTER TABLE access_request_apartments
      ADD COLUMN role ENUM('owner', 'tenant') NOT NULL DEFAULT 'owner' AFTER apartment_id
    `);
    ctx.log('role column added.');
  } else {
    ctx.log('role column already exists, skipping.');
  }
}
