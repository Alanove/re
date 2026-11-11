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
 * Migration: Create brands table
 * Date: 2026-01-08
 */

class CreateBrandsTableMigration {
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
      console.log('\n🔄 Running migration: Create brands table...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Check if table already exists
      const [tables] = await this.connection!.query<any[]>(
        `SHOW TABLES LIKE 'brands'`
      );

      if (tables.length > 0) {
        console.log('⚠️  Migration already applied (brands table exists)');
        return {
          success: true,
          message: 'Migration already applied'
        };
      }

      // Create brands table
      await this.connection!.query(`
        CREATE TABLE brands (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          logo_url VARCHAR(500),
          website_url VARCHAR(500),
          is_featured BOOLEAN DEFAULT FALSE,
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          meta_title VARCHAR(255),
          meta_description TEXT,
          meta_keywords VARCHAR(500),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_slug (slug),
          INDEX idx_featured (is_featured),
          INDEX idx_active (is_active),
          INDEX idx_display_order (display_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✓ Created: brands table');

      // Add brand_id to products table
      await this.connection!.query(`
        ALTER TABLE products
        ADD COLUMN brand_id INT NULL AFTER category_id,
        ADD INDEX idx_brand (brand_id),
        ADD CONSTRAINT fk_products_brand 
          FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
      `);
      console.log('  ✓ Added: brand_id column to products table');

      console.log('\n✅ Migration completed successfully!\n');

      return {
        success: true,
        message: 'Successfully created brands table'
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
      console.log('\n🔄 Rolling back migration: Create brands table...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Remove foreign key and column from products
      await this.connection!.query(`
        ALTER TABLE products
        DROP FOREIGN KEY IF EXISTS fk_products_brand,
        DROP INDEX IF EXISTS idx_brand,
        DROP COLUMN IF EXISTS brand_id
      `);
      console.log('  ✓ Removed: brand_id from products table');

      // Drop brands table
      await this.connection!.query(`DROP TABLE IF EXISTS brands`);
      console.log('  ✓ Dropped: brands table');

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'Successfully rolled back brands table'
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
  const migration = new CreateBrandsTableMigration();
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

export default CreateBrandsTableMigration;
