/**
 * Gate access: expiry_date, request email/expiry, rename Renter → Tenant.
 *
 * Rollback:
 * ALTER TABLE apartment_gate_access DROP COLUMN expiry_date;
 * ALTER TABLE gate_access_requests DROP COLUMN target_email, DROP COLUMN expiry_date;
 * UPDATE apartment_gate_access SET relation = 'Renter' WHERE relation = 'Tenant';
 * UPDATE gate_access_requests SET relation = 'Renter' WHERE relation = 'Tenant';
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

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return (rows as any[]).length > 0;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  if (await tableExists('apartment_gate_access')) {
    if (!(await columnExists('apartment_gate_access', 'expiry_date'))) {
      await db.query(`
        ALTER TABLE apartment_gate_access
        ADD COLUMN expiry_date DATE NULL AFTER relation
      `);
      ctx.log('apartment_gate_access.expiry_date added.');
    } else {
      ctx.log('apartment_gate_access.expiry_date already exists, skipping.');
    }

    const [agaResult] = await db.query(`
      UPDATE apartment_gate_access SET relation = 'Tenant' WHERE relation = 'Renter'
    `);
    ctx.log(`Renamed Renter→Tenant on apartment_gate_access: ${(agaResult as any).affectedRows} row(s).`);
  } else {
    ctx.log('apartment_gate_access missing, skipping.');
  }

  if (await tableExists('gate_access_requests')) {
    if (!(await columnExists('gate_access_requests', 'target_email'))) {
      await db.query(`
        ALTER TABLE gate_access_requests
        ADD COLUMN target_email VARCHAR(255) NULL AFTER target_phone
      `);
      ctx.log('gate_access_requests.target_email added.');
    } else {
      ctx.log('gate_access_requests.target_email already exists, skipping.');
    }

    if (!(await columnExists('gate_access_requests', 'expiry_date'))) {
      await db.query(`
        ALTER TABLE gate_access_requests
        ADD COLUMN expiry_date DATE NULL AFTER relation
      `);
      ctx.log('gate_access_requests.expiry_date added.');
    } else {
      ctx.log('gate_access_requests.expiry_date already exists, skipping.');
    }

    const [garResult] = await db.query(`
      UPDATE gate_access_requests SET relation = 'Tenant' WHERE relation = 'Renter'
    `);
    ctx.log(`Renamed Renter→Tenant on gate_access_requests: ${(garResult as any).affectedRows} row(s).`);
  } else {
    ctx.log('gate_access_requests missing, skipping.');
  }
}
