/**
 * Add listing description to listing requests and apartments.
 *
 * listing_requests.description — submitted by member, awaiting admin approval
 * apartments.listing_description — public description after approval
 *
 * Rollback:
 * ALTER TABLE listing_requests DROP COLUMN description;
 * ALTER TABLE apartments DROP COLUMN listing_description;
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
  ctx.log('Adding listing description columns...');

  if (!(await columnExists('listing_requests', 'description'))) {
    await db.query(`
      ALTER TABLE listing_requests
      ADD COLUMN description TEXT NULL AFTER request_type
    `);
    ctx.log('listing_requests.description added.');
  } else {
    ctx.log('listing_requests.description already exists, skipping.');
  }

  if (!(await columnExists('apartments', 'listing_description'))) {
    await db.query(`
      ALTER TABLE apartments
      ADD COLUMN listing_description TEXT NULL AFTER notes
    `);
    ctx.log('apartments.listing_description added.');
  } else {
    ctx.log('apartments.listing_description already exists, skipping.');
  }
}
