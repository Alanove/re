import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (same as app.ts)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

/**
 * Migration: Enhance variant_type_values table with additional properties
 * Adds: color_code, is_preselected columns
 * Date: 2026-01-07
 */

class EnhanceVariantValuesMigration {
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
      console.log('\n🔄 Running migration: Enhance variant_type_values table...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Check if columns already exist
      const [columns] = await this.connection!.query<any[]>(
        `SHOW COLUMNS FROM variant_type_values WHERE Field IN ('color_code', 'is_preselected')`
      );

      if (columns.length > 0) {
        console.log('⚠️  Migration already applied (columns exist)');
        return {
          success: true,
          message: 'Migration already applied'
        };
      }

      // Add color_code column
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        ADD COLUMN color_code VARCHAR(7) NULL COMMENT 'Hex color code for visual representation (e.g., #FF0000)'
        AFTER value
      `);
      console.log('  ✓ Added: color_code column');

      // Add is_preselected column
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        ADD COLUMN is_preselected BOOLEAN DEFAULT FALSE COMMENT 'Whether this value is preselected by default'
        AFTER is_active
      `);
      console.log('  ✓ Added: is_preselected column');

      // Add index for better query performance
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        ADD INDEX idx_is_preselected (is_preselected)
      `);
      console.log('  ✓ Added: index on is_preselected');

      console.log('\n✅ Migration completed successfully!\n');

      return {
        success: true,
        message: 'Successfully enhanced variant_type_values table'
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
      console.log('\n🔄 Rolling back migration: Enhance variant_type_values table...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Remove index
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        DROP INDEX IF EXISTS idx_is_preselected
      `);
      console.log('  ✓ Removed: index on is_preselected');

      // Remove is_preselected column
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        DROP COLUMN IF EXISTS is_preselected
      `);
      console.log('  ✓ Removed: is_preselected column');

      // Remove color_code column
      await this.connection!.query(`
        ALTER TABLE variant_type_values
        DROP COLUMN IF EXISTS color_code
      `);
      console.log('  ✓ Removed: color_code column');

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'Successfully rolled back variant_type_values enhancements'
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
  const migration = new EnhanceVariantValuesMigration();
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

export default EnhanceVariantValuesMigration;
