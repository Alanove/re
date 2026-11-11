import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Loaded env for:', nodeEnv);
// console.log('Checking DB_USER:', process.env.DB_USER); // Safe to log key existence?

import * as fs from 'fs'; 
// We don't import db here, we require it later.

// import { db } from '../src/config/database'; // Removed to use require

class AddProductAttributeSelectionMigration {
  private connection: mysql.PoolConnection | null = null;
  private db: any;

  constructor() {
     this.db = require('../src/config/database').db;
  }

  async up() {
    try {
      this.connection = await this.db.getConnection();
      if (!this.connection) throw new Error('Failed to get connection'); // Null check

      console.log('🚀 Starting migration: Add selected_values to product_attributes...\n');

      // 1. Ensure product_attributes table exists (it should, but just in case)
      await this.connection.query(`
        CREATE TABLE IF NOT EXISTS product_attributes (
          product_id INT NOT NULL,
          variant_type_id INT NOT NULL,
          PRIMARY KEY (product_id, variant_type_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✓ Verified: product_attributes table');

      // 2. Add selected_values column
      try {
        await this.connection.query(`
          ALTER TABLE product_attributes
          ADD COLUMN selected_values JSON NULL COMMENT 'Array of selected value IDs'
        `);
        console.log('  ✓ Added column: selected_values');
      } catch (err: any) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('  ⚠️  Column selected_values already exists');
        } else {
          throw err;
        }
      }

      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      if (this.connection) {
        this.connection.release();
      }
      process.exit(0);
    }
  }
}

// Run migration
new AddProductAttributeSelectionMigration().up();
