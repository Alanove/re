/**
 * Add discount_code to shopping_carts
 */

import dotenv from 'dotenv';
import * as path from 'path';

// Determine environment
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import * as mysql from 'mysql2/promise';

interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

class AddDiscountToCartMigration {
  private connection: mysql.PoolConnection | null = null;

  async up(): Promise<MigrationResult> {
    try {
      this.connection = await db.getConnection();
      
      console.log('🚀 Adding discount_code to shopping_carts table...\n');

      const query = `
        ALTER TABLE shopping_carts
        ADD COLUMN discount_code VARCHAR(255) NULL AFTER session_id
      `;
      
      try {
        await this.connection.query(query);
        console.log('  ✓ Updated: shopping_carts (added discount_code)');
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
          console.log('  ⚠️  Column discount_code already exists in shopping_carts');
        } else {
          throw error;
        }
      }

      console.log('\n✅ Migration completed successfully!\n');

      return {
        success: true,
        message: 'Migration completed successfully'
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

  async down(): Promise<MigrationResult> {
    try {
      this.connection = await db.getConnection();
      
      console.log('🔄 Rolling back discount_code column...\n');

      const query = 'ALTER TABLE shopping_carts DROP COLUMN discount_code';
      
      try {
        await this.connection.query(query);
        console.log('  ✓ Updated: shopping_carts (dropped discount_code)');
      } catch (error: any) {
         if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
             console.log('  ⚠️  Column discount_code does not exist');
         } else {
            throw error;
         }
      }

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'Rollback completed successfully'
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
  const migration = new AddDiscountToCartMigration();
  const command = process.argv[2];

  if (command === 'down') {
    migration.down()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  } else {
    migration.up()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  }
}

export default AddDiscountToCartMigration;
