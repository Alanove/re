import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

async function verify() {
    console.log('Connecting...');
    const conn = await mysql.createConnection(dbConfig);

    console.log('--- Verification ---');

    // 1. Check Category Images
    console.log('\n1. Checking Category Images...');
    const [cats] = await conn.query<any[]>('SELECT name, image_url FROM product_categories WHERE image_url IS NOT NULL LIMIT 5');
    if (cats.length > 0) {
        console.log('✅ Found categories with images:');
        console.table(cats);
    } else {
        console.log('⚠️ No categories with images found.');
    }

    // 2. Check Variant Type Values (Color Codes & Images)
    console.log('\n2. Checking Variant Values (Color/Image)...');
    const [vals] = await conn.query<any[]>('SELECT value, color_code, image_url FROM variant_type_values WHERE color_code IS NOT NULL OR image_url IS NOT NULL LIMIT 5');
    if (vals.length > 0) {
        console.log('✅ Found variant values with color/image:');
        console.table(vals);
    } else {
        console.log('⚠️ No variant values with color/image found.');
    }

    // 3. Check Menu
    console.log('\n3. Checking Menus...');
    const [menus] = await conn.query<any[]>('SELECT id, title, url, parent_id FROM menu LIMIT 10');
    if (menus.length > 0) {
        console.log('✅ Found menu items:');
        console.table(menus);
    } else {
        console.log('⚠️ No menu items found.');
    }

    await conn.end();
}

verify().catch(console.error);
