import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables BEFORE other imports
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import * as fs from 'fs';
import { createWorker } from 'tesseract.js';
import { db } from '../src/config/database';
import { DATA_PATHS } from '../src/constants/data-paths';

/**
 * Simple slugify function
 */
function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-');    // Replace multiple - with single -
}

/**
 * Main OCR function
 */
async function processBrandsOCR() {
    console.log('🚀 Starting Brands OCR process...');

    const brandsDir = path.join(DATA_PATHS.PUBLIC_DIR, 'images', 'brands');
    if (!fs.existsSync(brandsDir)) {
        console.error(`❌ Brands directory not found: ${brandsDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(brandsDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });

    console.log(`Found ${files.length} brand images to process.`);

    const worker = await createWorker();

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
        const filePath = path.join(brandsDir, file);
        const imageUrl = `/images/brands/${file}`;

        try {
            console.log(`Processing: ${file}...`);
            const { data: { text } } = await worker.recognize(filePath);

            // Clean up the extracted text
            let brandName = text.trim().split('\n')[0]; // Take the first line
            brandName = brandName.replace(/[^a-zA-Z0-9 ]/g, '').trim(); // Remove noise

            if (!brandName || brandName.length < 2) {
                // If OCR fails to get a good name, fallback to filename without extension
                brandName = path.parse(file).name.replace(/[-_]/g, ' ').trim();
                console.log(`  ⚠️  OCR returned poor quality text for ${file}, using filename fallback: "${brandName}"`);
            } else {
                console.log(`  ✅ OCR extracted: "${brandName}"`);
            }

            const slug = slugify(brandName);

            // Upsert into brands table
            await db.query(`
                INSERT INTO brands (name, slug, logo_url, is_active, display_order)
                VALUES (?, ?, ?, TRUE, 0)
                ON DUPLICATE KEY UPDATE 
                    logo_url = VALUES(logo_url),
                    updated_at = CURRENT_TIMESTAMP
            `, [brandName, slug, imageUrl]);

            successCount++;
        } catch (error) {
            console.error(`  ❌ Error processing ${file}:`, error);
            errorCount++;
        }
    }

    await worker.terminate();
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Processing Summary:`);
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    // Force exit to ensure DB connection pool is closed
    process.exit(0);
}

processBrandsOCR().catch(err => {
    console.error('Fatal error in Brands OCR:', err);
    process.exit(1);
});
