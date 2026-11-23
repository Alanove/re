import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function verifyDetailed() {
    console.log('Connecting to check enhanced migration...');
    const conn = await db.getConnection();

    try {
        console.log('\n--- 1. Checking Product Category Map ---');
        // Check if map table has entries
        const [mapCount] = await conn.query<any[]>('SELECT count(*) as count FROM product_categories_map');
        console.log(`Total mapped entires: ${mapCount[0].count}`);

        // Check a product with multiple categories
        const [multiCat] = await conn.query<any[]>(`
            SELECT product_id, COUNT(category_id) as cat_count 
            FROM product_categories_map 
            GROUP BY product_id 
            HAVING cat_count > 1 
            LIMIT 5
        `);
        
        if (multiCat.length > 0) {
            console.log('✅ Found products with multiple categories:', multiCat);
            const pid = multiCat[0].product_id;
            const [cats] = await conn.query<any[]>(`
                SELECT p.name as product_name, c.name as cat_name, pcm.is_primary 
                FROM product_categories_map pcm
                JOIN products p ON p.id = pcm.product_id
                JOIN product_categories c ON c.id = pcm.category_id
                WHERE pcm.product_id = ?
            `, [pid]);
            console.log(`Details for product ID ${pid}:`, cats);
        } else {
             console.log('⚠️ No products with multiple categories found (might be expected depending on source data).');
        }


        console.log('\n--- 2. Checking Attribute Linked Images ---');
        // Check images with attribute_value_id
        const [attrImages] = await conn.query<any[]>(`
            SELECT id, product_id, image_url, attribute_value_id 
            FROM product_images 
            WHERE attribute_value_id IS NOT NULL 
            LIMIT 5
        `);

        if (attrImages.length > 0) {
             console.log('✅ Found images linked to attributes:', attrImages);
             
             // Verify details
             const [details] = await conn.query<any[]>(`
                SELECT pi.image_url, vtv.value as color_name, vt.name as type_name
                FROM product_images pi
                JOIN variant_type_values vtv ON pi.attribute_value_id = vtv.id
                JOIN variant_types vt ON vtv.variant_type_id = vt.id
                WHERE pi.id = ?
             `, [attrImages[0].id]);
             console.log('Sample image link details:', details[0]);

        } else {
            console.log('⚠️ No images linked to attributes found.');
        }

        console.log('\n--- 3. Checking Variant Images (Should be empty or specific) ---');
        // We stopped inserting variant_id images unless unique. 
        // With current logic, variant_id should be NULL for most images, or only set if we had variant-specific images NOT handled by attributes.
        // Wait, my logic removed the variant_id insert block completely. 
        // So `variant_id` in `product_images` should be mostly NULL?
        // Let's check if ANY exist (maybe from old runs if I didn't truncate properly? I did clearData).
        
        const [varImages] = await conn.query<any[]>('SELECT COUNT(*) as count FROM product_images WHERE variant_id IS NOT NULL');
        console.log(`Images explicitly linked to variant_id: ${varImages[0].count}`);

        console.log('\n--- 4. Checking First-Image-Wins Logic ---');
        // Check if any product has multiple images for the same attribute value (which would be a violation of our new logic if strictly applied to Unique per value)
        // Wait, multiple images per attribute value? No, one image per attribute value. 
        // But multiple VARIANTS might share the same attribute value. 
        // We want to see if `product_images` has duplicates for `attribute_value_id` for the SAME product.
        const [dupes] = await conn.query<any[]>(`
            SELECT product_id, attribute_value_id, COUNT(*) as c 
            FROM product_images 
            WHERE attribute_value_id IS NOT NULL 
            GROUP BY product_id, attribute_value_id 
            HAVING c > 1
        `);
        if (dupes.length > 0) {
            console.log('⚠️ Found duplicates for attribute images (Rule violation?):', dupes);
        } else {
            console.log('✅ No duplicate images for the same attribute value per product found. First-Image-Wins logic seems valid.');
        }

        // Check if "Butter" product has images
        const [butter] = await conn.query<any[]>(`SELECT id, name FROM products WHERE name LIKE '%Butter%' LIMIT 1`);
        if (butter.length > 0) {
            console.log(`\nChecking 'Butter' Product (ID: ${butter[0].id})...`);
            const [bImages] = await conn.query<any[]>('SELECT * FROM product_images WHERE product_id = ?', [butter[0].id]);
            console.log(`Total Images for 'Butter': ${bImages.length}`);
            console.table(bImages.map((i: any) => ({id: i.id, url: i.image_url, attr_id: i.attribute_value_id})));
        }

    } catch(e) {
        console.error("Verification Error:", e);
    } finally {
        conn.release();
        await db.close();
    }
}

verifyDetailed().catch(console.error);
