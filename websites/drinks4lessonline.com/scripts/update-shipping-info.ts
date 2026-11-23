import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { db } from '../src/config/database';

// --- CONFIGURATION ---

// WordPress Database Configuration (Source)
const WP_DB_CONFIG = {
    host: 'localhost',
    user: 'sa',
    password: 'P@55w0rd',
    database: 'guerrasports_gs_7dmrf',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const WP_PREFIX = 'z3ouw3fl_'; 

class ShippingMigration {
    private wpConnection: mysql.Pool | null = null;
    private localConnection: mysql.PoolConnection | null = null;

    async connect() {
        try {
            console.log('🔌 Connecting to databases...');

            // Connect to WP Database
            this.wpConnection = mysql.createPool(WP_DB_CONFIG);
            await this.wpConnection.query('SELECT 1');
            console.log('   ✅ Connected to WordPress Database');

            // Connect to Local Database
            const localPool = db.getPool();
            this.localConnection = await localPool.getConnection();
            console.log('   ✅ Connected to Local Database');

        } catch (error) {
            console.error('❌ Connection failed:', error);
            throw error;
        }
    }

    async close() {
        if (this.wpConnection) {
            await this.wpConnection.end();
        }
        if (this.localConnection) {
            this.localConnection.release();
        }
        await db.close();
    }

    async getAllMeta(postId: number): Promise<Record<string, string>> {
        const [rows] = await this.wpConnection!.query<any[]>(`
            SELECT meta_key, meta_value FROM ${WP_PREFIX}postmeta WHERE post_id = ?
        `, [postId]);

        const meta: Record<string, string> = {};
        for (const r of rows) {
            meta[r.meta_key] = r.meta_value;
        }
        return meta;
    }

    async run() {
        try {
            await this.connect();

            console.log('\n📦 Updating Shipping Information...');
            
            const [products] = await this.wpConnection!.query<any[]>(`
                SELECT ID, post_title, post_name, post_status
                FROM ${WP_PREFIX}posts 
                WHERE post_type = 'product' AND post_status IN ('publish', 'draft')
            `);

            let updatedCount = 0;
            let skippedCount = 0;
            let notFoundCount = 0;

            for (const p of products) {
                const meta = await this.getAllMeta(p.ID);

                const weight = meta['_weight'] ? parseFloat(meta['_weight']) : null;
                const length = meta['_length'] ? parseFloat(meta['_length']) : null;
                const width = meta['_width'] ? parseFloat(meta['_width']) : null;
                const height = meta['_height'] ? parseFloat(meta['_height']) : null;
                
                // Determine SKU exactly as migration script did to ensure matches
                const sku = meta['_sku'] || `WP-${p.ID}`;
                
                // Construct log details
                const dims = [];
                if (weight) dims.push(`W:${weight}`);
                if (length) dims.push(`L:${length}`);
                if (width) dims.push(`Wd:${width}`);
                if (height) dims.push(`H:${height}`);

                if (dims.length === 0) {
                    // No shipping info to update
                    skippedCount++;
                    continue;
                }

                // Check if product exists locally
                const [localRows] = await this.localConnection!.query<any[]>(
                    'SELECT id FROM products WHERE sku = ?', 
                    [sku]
                );

                if (localRows.length === 0) {
                   // console.warn(`   ⚠️ Local product not found for SKU: ${sku} (WP ID: ${p.ID})`);
                    notFoundCount++;
                    continue;
                }

                const localId = localRows[0].id;

                // Update
                await this.localConnection!.query(`
                    UPDATE products 
                    SET weight = ?, length = ?, width = ?, height = ?
                    WHERE id = ?
                `, [weight, length, width, height, localId]);

               // console.log(`   ✅ Updated ${sku}: ${dims.join(', ')}`);
                updatedCount++;
            }

            console.log('\n-----------------------------------');
            console.log(`✅ Update Successful`);
            console.log(`   Updated: ${updatedCount}`);
            console.log(`   Skipped (No info): ${skippedCount}`);
            console.log(`   Not Found (Matching SKU): ${notFoundCount}`);
            
        } catch (error) {
            console.error('\n❌ Update failed:', error);
        } finally {
            await this.close();
        }
    }
}

if (require.main === module) {
    const migration = new ShippingMigration();
    migration.run();
}

export default ShippingMigration;
