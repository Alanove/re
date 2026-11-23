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
 * Migration: Add performance indexes
 * Date: 2026-01-28
 * Description: Adds indexes to speed up cart operations and product filtering
 */

class PerformanceIndexesMigration {
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
      console.log('\n🔄 Running migration: Add performance indexes...\n');
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Database User: ${dbConfig.user}`);
      console.log(`  Database Host: ${dbConfig.host}`);

      if (!this.connection) {
        await this.connect();
      }

      // 1. Add index to cart_items for faster lookup during add-to-cart
      // cartService.findCartItem uses: cart_id, product_id, variant_id
      try {
        await this.connection!.query(`
          CREATE INDEX idx_cart_items_lookup 
          ON cart_items (cart_id, product_id, variant_id)
        `);
        console.log('  ✓ Created index: idx_cart_items_lookup on cart_items');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('  ⚠️  Index idx_cart_items_lookup already exists');
        } else {
          throw error;
        }
      }

      // 2. Add index to product_variants for faster stock check and joins
      // used in productService.isInStock and cart joins
      try {
        await this.connection!.query(`
          CREATE INDEX idx_product_variants_lookup 
          ON product_variants (product_id, is_active)
        `);
        console.log('  ✓ Created index: idx_product_variants_lookup on product_variants');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('  ⚠️  Index idx_product_variants_lookup already exists');
        } else {
          throw error;
        }
      }

      // 3. Add index to products for price filtering
      try {
        await this.connection!.query(`
          CREATE INDEX idx_products_price 
          ON products (price)
        `);
        console.log('  ✓ Created index: idx_products_price on products');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('  ⚠️  Index idx_products_price already exists');
        } else {
          throw error;
        }
      }

      console.log('\n✅ Migration completed successfully!\n');

      return {
        success: true,
        message: 'Successfully added performance indexes'
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
      console.log('\n🔄 Rolling back migration: Add performance indexes...\n');

      if (!this.connection) {
        await this.connect();
      }

      try {
        await this.connection!.query('DROP INDEX idx_cart_items_lookup ON cart_items');
        console.log('  ✓ Dropped index: idx_cart_items_lookup');
      } catch (e) { console.log('  ⚠️  Could not drop idx_cart_items_lookup'); }

      try {
        await this.connection!.query('DROP INDEX idx_product_variants_lookup ON product_variants');
        console.log('  ✓ Dropped index: idx_product_variants_lookup');
      } catch (e) { console.log('  ⚠️  Could not drop idx_product_variants_lookup'); }

      try {
        await this.connection!.query('DROP INDEX idx_products_price ON products');
        console.log('  ✓ Dropped index: idx_products_price');
      } catch (e) { console.log('  ⚠️  Could not drop idx_products_price'); }

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'Successfully rolled back performance indexes'
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
  const migration = new PerformanceIndexesMigration();
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

export default PerformanceIndexesMigration;
