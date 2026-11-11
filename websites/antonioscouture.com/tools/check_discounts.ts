
import dotenv from 'dotenv';
import * as path from 'path';

// Determine environment
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function checkDiscounts() {
    try {
        console.log('Checking discounts...');
        const [rows] = await db.query('SELECT * FROM discounts');
        if (Array.isArray(rows) && rows.length > 0) {
            console.log('Found discounts:');
            console.log(JSON.stringify(rows.map((d: any) => ({
                code: d.code,
                value: d.value,
                type: d.type,
                active: d.is_active,
                expiry: d.end_date
            })), null, 2));
        } else {
            console.log('No discounts found.');
            // Create a test discount
            console.log('Creating TEST10 discount...');
            await db.query(`
                INSERT INTO discounts (code, name, type, value, is_active, start_date)
                VALUES ('TEST10', 'Test Discount 10%', 'percentage', 10, 1, NOW())
            `);
            console.log('Created TEST10');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDiscounts();
