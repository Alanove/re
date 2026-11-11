/**
 * Fix owner history data, add gate access relation, seed default owner/renter access
 *
 * Rollback:
 * ALTER TABLE apartment_gate_access DROP COLUMN relation;
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows as any[])[0].cnt > 0;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Fixing owner history and gate access relations...');

  if (!(await columnExists('apartment_gate_access', 'relation'))) {
    ctx.log('Adding relation column to apartment_gate_access...');
    await db.query(`
      ALTER TABLE apartment_gate_access
        ADD COLUMN relation VARCHAR(50) NOT NULL DEFAULT 'Other' AFTER user_id
    `);
  }

  ctx.log('Rebuilding apartment owner history from current owners...');
  await db.query(`DELETE FROM apartment_owner_history`);
  const [seedResult] = await db.query(`
    INSERT INTO apartment_owner_history (apartment_id, user_id, start_date, end_date)
    SELECT a.id, a.owner_id,
           COALESCE(a.registration_date, DATE(a.created_at), NOW()),
           NULL
    FROM apartments a
    WHERE a.owner_id IS NOT NULL
  `);
  ctx.log(`Rebuilt ${(seedResult as any).affectedRows || 0} owner history row(s).`);

  ctx.log('Seeding default gate access for owners and renters...');
  await db.query(`
    INSERT INTO apartment_gate_access (apartment_id, user_id, relation)
    SELECT a.id, a.owner_id, 'Owner'
    FROM apartments a
    WHERE a.owner_id IS NOT NULL
    ON DUPLICATE KEY UPDATE relation = 'Owner'
  `);
  await db.query(`
    INSERT INTO apartment_gate_access (apartment_id, user_id, relation)
    SELECT a.id, a.renter_id, 'Renter'
    FROM apartments a
    WHERE a.renter_id IS NOT NULL
    ON DUPLICATE KEY UPDATE relation = 'Renter'
  `);
}
