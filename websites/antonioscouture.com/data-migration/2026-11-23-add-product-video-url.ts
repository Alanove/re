/**
 * Add products.video_url for optional product gallery video (plays first on PDP).
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

class AddProductVideoUrlMigration {
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
      console.log('\n🔄 Running migration: Add video_url to products...\n');

      if (!this.connection) {
        await this.connect();
      }

      const conn = this.connection!;

      const [cols] = await conn.query<any[]>(
        `SHOW COLUMNS FROM products WHERE Field = 'video_url'`
      );
      if (cols.length > 0) {
        console.log('  ⚠️  products.video_url already exists — skip');
      } else {
        await conn.query(
          `ALTER TABLE products ADD COLUMN video_url VARCHAR(512) NULL AFTER is_new_arrival`
        );
        console.log('  ✓ Added: products.video_url');
      }

      console.log('\n✅ Migration completed successfully!\n');
      return { success: true, message: 'video_url column added to products' };
    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      return { success: false, message: 'Migration failed', error: error.message };
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }
}

export default AddProductVideoUrlMigration;
