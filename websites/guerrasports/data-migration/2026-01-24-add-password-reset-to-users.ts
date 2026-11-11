import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

/**
 * Migration: Add password reset columns to users table
 * Date: 2026-01-24
 */

class AddPasswordResetToUsersMigration {
  private connection: mysql.PoolConnection | null = null;

  async connect(): Promise<void> {
    const pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    this.connection = await pool.getConnection();
    console.log('✓ Connected to database');
  }

  async run(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log('\n🔄 Running migration: Add password reset columns to users table...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Check if columns already exist
      const [columns] = await this.connection!.query<any[]>(
        `SHOW COLUMNS FROM users LIKE 'reset_password_token'`
      );

      if (columns.length > 0) {
        console.log('⚠️  Migration already applied (columns exist)');
        return {
          success: true,
          message: 'Migration already applied'
        };
      }

      // Add columns
      await this.connection!.query(`
        ALTER TABLE users
        ADD COLUMN reset_password_token VARCHAR(255) NULL AFTER role,
        ADD COLUMN reset_password_expires DATETIME NULL AFTER reset_password_token,
        ADD INDEX idx_reset_token (reset_password_token)
      `);
      console.log('  ✓ Added: reset_password_token and reset_password_expires columns to users table');

      console.log('\n✅ Migration completed successfully!\n');

      return {
        success: true,
        message: 'Successfully added password reset columns'
      };
    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        message: 'Migration failed',
        error: error.message
      };
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }

  async rollback(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log('\n🔄 Rolling back migration: Remove password reset columns...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Remove columns
      await this.connection!.query(`
        ALTER TABLE users
        DROP INDEX IF EXISTS idx_reset_token,
        DROP COLUMN IF EXISTS reset_password_expires,
        DROP COLUMN IF EXISTS reset_password_token
      `);
      console.log('  ✓ Removed: reset_password_token and reset_password_expires from users table');

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'Successfully rolled back password reset columns'
      };
    } catch (error: any) {
      console.error('❌ Rollback failed:', error);
      return {
        success: false,
        message: 'Rollback failed',
        error: error.message
      };
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new AddPasswordResetToUsersMigration();
  const command = process.argv[2] || 'run';

  (async () => {
    try {
      if (command === 'rollback') {
        const result = await migration.rollback();
        process.exit(result.success ? 0 : 1);
      } else {
        const result = await migration.run();
        process.exit(result.success ? 0 : 1);
      }
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

export default AddPasswordResetToUsersMigration;
