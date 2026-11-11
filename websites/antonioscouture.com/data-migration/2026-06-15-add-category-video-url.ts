import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

class AddCategoryVideoUrlMigration {
  private connection: mysql.PoolConnection | null = null;

  async connect(): Promise<void> {
    const pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    this.connection = await pool.getConnection();
    console.log('✓ Connected to database');
  }

  async run(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log('\n🔄 Running migration: Add video_url to product_categories...\n');

      if (!this.connection) {
        await this.connect();
      }

      const conn = this.connection!;

      const [cols] = await conn.query<any[]>(
        `SHOW COLUMNS FROM product_categories WHERE Field = 'video_url'`
      );
      if (cols.length > 0) {
        console.log('  ⚠️  product_categories.video_url already exists — skip');
      } else {
        await conn.query(
          `ALTER TABLE product_categories ADD COLUMN video_url VARCHAR(512) NULL AFTER thumb_url`
        );
        console.log('  ✓ Added: product_categories.video_url');
      }

      console.log('\n✅ Migration completed successfully!\n');
      return { success: true, message: 'video_url column added to product_categories' };
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

if (require.main === module) {
  const migration = new AddCategoryVideoUrlMigration();
  (async () => {
    const result = await migration.run();
    process.exit(result.success ? 0 : 1);
  })();
}

export default AddCategoryVideoUrlMigration;
