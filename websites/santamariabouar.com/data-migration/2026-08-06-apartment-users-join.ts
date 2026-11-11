/**
 * Create apartment_users join table (many-to-many owners/tenants)
 * and seed from apartments.owner_id / apartments.renter_id.
 *
 * Rollback:
 * DROP TABLE apartment_users;
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return (rows as any[])[0].cnt > 0;
}

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Creating apartment_users join table...');

  if (!(await tableExists('apartment_users'))) {
    await db.query(`
      CREATE TABLE apartment_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner', 'tenant') NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_apartment_user_role (apartment_id, user_id, role),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_au_user (user_id),
        INDEX idx_au_apartment_role (apartment_id, role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    ctx.log('apartment_users table created.');
  } else {
    ctx.log('apartment_users already exists, skipping create.');
  }

  ctx.log('Seeding primary owners from apartments.owner_id...');
  const [ownerResult] = await db.query(`
    INSERT IGNORE INTO apartment_users (apartment_id, user_id, role, is_primary)
    SELECT a.id, a.owner_id, 'owner', 1
    FROM apartments a
    WHERE a.owner_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = a.owner_id)
  `);
  ctx.log(`Seeded ${(ownerResult as any).affectedRows || 0} primary owner row(s).`);

  ctx.log('Seeding tenants from apartments.renter_id...');
  const [tenantResult] = await db.query(`
    INSERT IGNORE INTO apartment_users (apartment_id, user_id, role, is_primary)
    SELECT a.id, a.renter_id, 'tenant', 0
    FROM apartments a
    WHERE a.renter_id IS NOT NULL
      AND a.renter_id <> COALESCE(a.owner_id, 0)
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = a.renter_id)
  `);
  ctx.log(`Seeded ${(tenantResult as any).affectedRows || 0} tenant row(s).`);

  ctx.log('apartment_users migration complete.');
}
