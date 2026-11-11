
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function verify() {
    try {
        const pool = db.getPool();
        const connection = await pool.getConnection();

        console.log('Checking for products with shipping info...');
        const [rows] = await connection.query<any[]>(`
            SELECT id, sku, weight, length, width, height 
            FROM products 
            WHERE weight IS NOT NULL OR length IS NOT NULL OR width IS NOT NULL OR height IS NOT NULL
            LIMIT 10
        `);

        if (rows.length === 0) {
            console.log('❌ No products found with shipping info.');
        } else {
            console.log(`✅ Found ${rows.length} products with shipping info:`);
            console.log(JSON.stringify(rows, null, 2));
        }

        connection.release();
        await db.close();

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
