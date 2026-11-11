/**
 * Add renter_id, apartment_gate_access, and apartment_owner_history
 *
 * Rollback:
 * ALTER TABLE apartments DROP FOREIGN KEY fk_apartments_renter;
 * ALTER TABLE apartments DROP COLUMN renter_id;
 * DROP TABLE apartment_gate_access;
 * DROP TABLE apartment_owner_history;
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

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return (rows as any[])[0].cnt > 0;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Adding apartment renter, gate access, and owner history...');

  if (!(await columnExists('apartments', 'renter_id'))) {
    ctx.log('Adding renter_id column to apartments...');
    await db.query(`
      ALTER TABLE apartments
        ADD COLUMN renter_id INT NULL AFTER owner_id,
        ADD INDEX idx_apartments_renter (renter_id)
    `);
    await db.query(`
      ALTER TABLE apartments
        ADD CONSTRAINT fk_apartments_renter
        FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    ctx.log('renter_id added.');
  } else {
    ctx.log('renter_id already exists, skipping.');
  }

  if (!(await tableExists('apartment_gate_access'))) {
    ctx.log('Creating apartment_gate_access table...');
    await db.query(`
      CREATE TABLE apartment_gate_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_apartment_user (apartment_id, user_id),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_gate_access_apartment (apartment_id),
        INDEX idx_gate_access_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    ctx.log('apartment_gate_access created.');
  } else {
    ctx.log('apartment_gate_access already exists, skipping.');
  }

  if (!(await tableExists('apartment_owner_history'))) {
    ctx.log('Creating apartment_owner_history table...');
    await db.query(`
      CREATE TABLE apartment_owner_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        user_id INT NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NULL,
        changed_by INT NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_owner_history_apartment (apartment_id),
        INDEX idx_owner_history_user (user_id),
        INDEX idx_owner_history_current (apartment_id, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    ctx.log('apartment_owner_history created.');
  } else {
    ctx.log('apartment_owner_history already exists, skipping.');
  }

  ctx.log('Seeding owner history for existing apartments...');
  const [seedResult] = await db.query(`
    INSERT INTO apartment_owner_history (apartment_id, user_id, start_date, end_date)
    SELECT a.id, a.owner_id,
           COALESCE(a.registration_date, DATE(a.created_at), NOW()),
           NULL
    FROM apartments a
    WHERE a.owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM apartment_owner_history h
        WHERE h.apartment_id = a.id AND h.end_date IS NULL
      )
  `);
  ctx.log(`Seeded ${(seedResult as any).affectedRows || 0} owner history row(s).`);
}
