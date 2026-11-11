
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables before importing database config
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

import * as fs from 'fs';
import { db } from '../src/config/database';
import { DATA_PATHS } from '../src/constants';

async function fixBrandImages() {
    console.log('Starting brand images fix...');

    try {
        // Get all brands
        const [brands] = await db.query<any>('SELECT * FROM brands');
        console.log(`Found ${brands.length} brands.`);

        const brandsDir = path.join(DATA_PATHS.IMAGES_DIR, 'brands');
        if (!fs.existsSync(brandsDir)) {
            console.log(`Creating brands directory: ${brandsDir}`);
            fs.mkdirSync(brandsDir, { recursive: true });
        }

        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const brand of brands) {
            if (!brand.logo_url) continue;

            const logoUrl = brand.logo_url;

            // Check if it's in the wrong folder (categories) or starts with category-
            // Typical wrong URL: /images/categories/category-123.jpg
            const isWrongFolder = logoUrl.includes('/categories/');
            const hasWrongPrefix = path.basename(logoUrl).startsWith('category-');

            if (isWrongFolder || hasWrongPrefix) {
                console.log(`Processing brand ${brand.id} (${brand.name}): ${logoUrl}`);

                // Construct absolute path
                const relativePath = logoUrl.startsWith('/') ? logoUrl.substring(1) : logoUrl;
                const oldFilePath = path.join(DATA_PATHS.PUBLIC_DIR, relativePath);

                if (fs.existsSync(oldFilePath)) {
                    // Determine new filename
                    const oldFilename = path.basename(oldFilePath);

                    // Generate new filename: replace category- with brand- or just prefix with brand- if missing
                    let newFilename = oldFilename;
                    if (newFilename.startsWith('category-')) {
                        newFilename = newFilename.replace('category-', 'brand-');
                    } else if (!newFilename.startsWith('brand-')) {
                        newFilename = `brand-${newFilename}`;
                    }

                    const newFilePath = path.join(brandsDir, newFilename);

                    // Update DB URL
                    const newLogoUrl = `/images/brands/${newFilename}`;

                    // Move file
                    try {
                        // Check if destination already exists (to prevent overwriting if running multiple times or conflict)
                        if (fs.existsSync(newFilePath) && newFilePath !== oldFilePath) {
                            console.log(`Destination file already exists: ${newFilePath}. Will generate unique name.`);
                            const parsed = path.parse(newFilename);
                            newFilename = `${parsed.name}-${Date.now()}${parsed.ext}`;
                        }

                        const finalFilePath = path.join(brandsDir, newFilename);

                        console.log(`Moving ${oldFilePath} -> ${finalFilePath}`);

                        // Create directory if it somehow doesn't exist
                        if (!fs.existsSync(path.dirname(finalFilePath))) {
                            fs.mkdirSync(path.dirname(finalFilePath), { recursive: true });
                        }

                        // Copy and then unlink to simulate move safely
                        fs.copyFileSync(oldFilePath, finalFilePath);
                        fs.unlinkSync(oldFilePath);

                        // Update DB
                        const finalLogoUrl = `/images/brands/${newFilename}`;

                        await db.query('UPDATE brands SET logo_url = ? WHERE id = ?', [finalLogoUrl, brand.id]);
                        console.log(`Updated DB for brand ${brand.id} to ${finalLogoUrl}`);
                        updatedCount++;

                    } catch (err) {
                        console.error(`Error moving file for brand ${brand.id}:`, err);
                        errorCount++;
                    }
                } else {
                    console.log(`File not found at ${oldFilePath}, skipping move.`);
                    // If the file is missing from disk but DB points to it, we can't move it.
                    errorCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log(`Finished. Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    } catch (error) {
        console.error('Script failed:', error);
    } finally {
        // Close the database connection
        try {
            await db.close();
        } catch (e) {
            // ignore
        }
        process.exit(0);
    }
}

fixBrandImages();
