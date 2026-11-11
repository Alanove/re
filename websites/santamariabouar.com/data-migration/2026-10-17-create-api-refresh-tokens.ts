/**
 * Create api_refresh_tokens for the mobile app REST API (/api/v1).
 * Stores only a SHA-256 hash of each refresh token; tokens rotate on every refresh.
 * Idempotent: CREATE TABLE IF NOT EXISTS.
 *
 * Rollback:
 * DROP TABLE IF EXISTS api_refresh_tokens;
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Creating api_refresh_tokens...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS api_refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      device_name VARCHAR(120) NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_api_refresh_token_hash (token_hash),
      INDEX idx_api_refresh_user (user_id),
      CONSTRAINT fk_api_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  ctx.log('api_refresh_tokens ready.');
}
