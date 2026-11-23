import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

class AddImageThumbUrlColumnsMigration {
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
      console.log('\n🔄 Running migration: Add thumb_url columns for images...\n');

      if (!this.connection) {
        await this.connect();
      }

      const conn = this.connection!;

      const addColumn = async (table: string, column: string, after?: string) => {
        const [cols] = await conn.query<any[]>(
          `SHOW COLUMNS FROM ${table} WHERE Field = ?`,
          [column]
        );
        if (cols.length > 0) {
          console.log(`  ⚠️  ${table}.${column} already exists — skip`);
          return;
        }
        const afterClause = after ? ` AFTER ${after}` : '';
        await conn.query(
          `ALTER TABLE ${table} ADD COLUMN ${column} VARCHAR(512) NULL${afterClause}`
        );
        console.log(`  ✓ Added: ${table}.${column}`);
      };

      await addColumn('product_images', 'thumb_url', 'image_url');
      await addColumn('product_categories', 'thumb_url', 'image_url');
      await addColumn('variant_type_values', 'thumb_url', 'image_url');

      console.log('\n✅ Migration completed successfully!\n');
      return { success: true, message: 'thumb_url columns added' };
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
  const migration = new AddImageThumbUrlColumnsMigration();
  (async () => {
    const result = await migration.run();
    process.exit(result.success ? 0 : 1);
  })();
}

export default AddImageThumbUrlColumnsMigration;
