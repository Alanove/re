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

class AddImageToVariantValuesMigration {
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
            console.log('\n🔄 Running migration: Add image_url to variant_type_values...\n');

            if (!this.connection) {
                await this.connect();
            }

            // Check if column already exists
            const [columns] = await this.connection!.query<any[]>(
                `SHOW COLUMNS FROM variant_type_values WHERE Field = 'image_url'`
            );

            if (columns.length > 0) {
                console.log('⚠️  Migration already applied (image_url exists)');
                return {
                    success: true,
                    message: 'Migration already applied'
                };
            }

            // Add image_url column
            await this.connection!.query(`
        ALTER TABLE variant_type_values
        ADD COLUMN image_url VARCHAR(500) NULL COMMENT 'URL for attribute value image (e.g. pattern swatch)'
        AFTER color_code
      `);
            console.log('  ✓ Added: image_url column');

            console.log('\n✅ Migration completed successfully!\n');

            return {
                success: true,
                message: 'Successfully added image_url'
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
            if (!this.connection) {
                await this.connect();
            }
            await this.connection!.query(`
        ALTER TABLE variant_type_values
        DROP COLUMN IF EXISTS image_url
      `);
            return { success: true, message: 'Rolled back successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        } finally {
            if (this.connection) this.connection.release();
        }
    }
}

// Run if called directly
if (require.main === module) {
    const migration = new AddImageToVariantValuesMigration();
    (async () => {
        try {
            const result = await migration.run();
            process.exit(result.success ? 0 : 1);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    })();
}

export default AddImageToVariantValuesMigration;
