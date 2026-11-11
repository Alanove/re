/**
 * Add background_image and seo_image to pages.
 * Idempotent: safe if columns were already added outside the migration runner.
 *
 * Rollback:
 * ALTER TABLE pages DROP COLUMN seo_image;
 * ALTER TABLE pages DROP COLUMN background_image;
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
  ctx.log('Adding pages.background_image and pages.seo_image...');

  if (!(await columnExists('pages', 'background_image'))) {
    await db.query(`
      ALTER TABLE pages
      ADD COLUMN background_image VARCHAR(500) NULL AFTER content
    `);
    ctx.log('pages.background_image added.');
  } else {
    ctx.log('pages.background_image already exists, skipping.');
  }

  if (!(await columnExists('pages', 'seo_image'))) {
    await db.query(`
      ALTER TABLE pages
      ADD COLUMN seo_image VARCHAR(500) NULL AFTER background_image
    `);
    ctx.log('pages.seo_image added.');
  } else {
    ctx.log('pages.seo_image already exists, skipping.');
  }
}
