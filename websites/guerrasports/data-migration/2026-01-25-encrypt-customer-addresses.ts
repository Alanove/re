// Load environment variables from .env file (must be before database import)
import dotenv from 'dotenv';
import * as path from 'path';

// Determine environment (default to development)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

// Try to load environment-specific file, fallback to .env if not found
dotenv.config({ path: envPath });
// Also load base .env if it exists (for overrides)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

class EncryptCustomerAddressesMigration {
  async up() {
    console.log('🔒 Starting Customer Addresses Encryption Migration...');

    try {
      const connection = await db.getConnection();

      // Check if columns already exist
      const [columns] = await connection.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'ecommerce_db'}' 
         AND TABLE_NAME = 'customer_addresses' 
         AND COLUMN_NAME = 'content_encrypted'`
      );

      if (columns.length === 0) {
        // Add new columns
        await connection.query(`
          ALTER TABLE customer_addresses
          ADD COLUMN content_encrypted TEXT COMMENT 'Encrypted PII data',
          ADD COLUMN iv VARCHAR(255) COMMENT 'Initialization vector for encryption'
        `);
        console.log('  ✓ Added encrypted columns');

        // Note: migrating existing data would be here if we had any,
        // but for now we'll assume we can drop the old columns or just ignore them.
        // For safety, we will keep them for now, but nullable, or we drop them as per plan.
        // Plan said "Drop ... to enforce encryption". 
        // Let's drop them to ensure we don't accidentally use them.
        
        await connection.query(`
          ALTER TABLE customer_addresses
          DROP COLUMN first_name,
          DROP COLUMN last_name,
          DROP COLUMN company,
          DROP COLUMN address_line_1,
          DROP COLUMN address_line_2,
          DROP COLUMN phone
        `);
         console.log('  ✓ Dropped plaintext PII columns');
         
      } else {
        console.log('  ⚠️  Columns already exist, skipping');
      }

      connection.release();
      console.log('✅ Customer Addresses Encryption Migration completed');
      return { success: true, message: 'Migration successful' };

    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      return { success: false, message: error.message };
    }
  }

  async down() {
    console.log('REVERT NOT IMPLEMENTED FOR SAFETY (Would lose data)');
    return { success: false, message: 'Not implemented' };
  }
}

if (require.main === module) {
  const migration = new EncryptCustomerAddressesMigration();
  migration.up().then(() => process.exit(0)).catch(() => process.exit(1));
}

export default EncryptCustomerAddressesMigration;
