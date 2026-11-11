/**
 * Data Migration: Migrate Variant Images to Attribute Values
 * 
 * This migration:
 * 1. Finds all product_images with a variant_id
 * 2. Parses the variant's attributes JSON to identify attribute values
 * 3. For each attribute that has_image = true, assigns the variant image to the corresponding attribute value
 * 4. Updates variant_type_values.image_url with the migrated image
 * 
 * Run: npx ts-node data-migration/migrate-variant-images.ts
 */

import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

interface VariantImage {
    image_id: number;
    product_id: number;
    variant_id: number;
    image_url: string;
    variant_name: string;
    attributes: string;
}

interface AttributeType {
    id: number;
    name: string;
    has_image: boolean;
}

async function migrateVariantImages() {
    console.log('🔄 Starting variant image migration...\n');

    try {
        const connection = await db.getConnection();

        // Get all variant images
        const [variantImages] = await connection.query<any[]>(`
      SELECT 
        pi.id as image_id,
        pi.product_id,
        pi.variant_id,
        pi.image_url,
        pv.name as variant_name,
        pv.attributes
      FROM product_images pi
      JOIN product_variants pv ON pi.variant_id = pv.id
      WHERE pi.variant_id IS NOT NULL
    `);

        console.log(`Found ${variantImages.length} variant images to migrate\n`);

        if (variantImages.length === 0) {
            console.log('✅ No variant images to migrate. Migration complete!\n');
            connection.release();
            return;
        }

        // Get all attribute types that support images
        const [attributeTypes] = await connection.query<any[]>(`
      SELECT id, name, has_image 
      FROM variant_types 
      WHERE has_image = TRUE
    `);

        const imageAttributeNames = new Set(attributeTypes.map((at: any) => at.name.toLowerCase()));

        console.log(`Attribute types that support images: ${Array.from(imageAttributeNames).join(', ')}\n`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const variantImage of variantImages) {
            try {
                const attributes = JSON.parse(variantImage.attributes);
                let imageMigrated = false;

                // Find which attribute supports images
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    if (imageAttributeNames.has(attrName.toLowerCase())) {
                        // Find the variant_type_value for this attribute value
                        const [valueRows] = await connection.query<any[]>(`
              SELECT vtv.id, vtv.image_url
              FROM variant_type_values vtv
              JOIN variant_types vt ON vtv.variant_type_id = vt.id
              WHERE vt.name = ? AND vtv.value = ?
            `, [attrName, attrValue]);

                        if (valueRows.length > 0) {
                            const valueId = valueRows[0].id;
                            const existingImage = valueRows[0].image_url;

                            // Only update if no image exists yet
                            if (!existingImage) {
                                await connection.query(`
                  UPDATE variant_type_values 
                  SET image_url = ? 
                  WHERE id = ?
                `, [variantImage.image_url, valueId]);

                                console.log(`✅ Migrated: ${attrName}="${attrValue}" -> ${variantImage.image_url}`);
                                migratedCount++;
                                imageMigrated = true;
                            } else {
                                console.log(`⏭️  Skipped: ${attrName}="${attrValue}" (already has image: ${existingImage})`);
                                skippedCount++;
                                imageMigrated = true;
                            }
                        } else {
                            console.log(`⚠️  Warning: Could not find attribute value for ${attrName}="${attrValue}"`);
                            errorCount++;
                        }

                        break; // Only migrate to one attribute per variant image
                    }
                }

                if (!imageMigrated) {
                    console.log(`⚠️  Warning: Variant "${variantImage.variant_name}" has no image-supporting attributes`);
                    errorCount++;
                }
            } catch (error: any) {
                console.error(`❌ Error processing variant image ${variantImage.image_id}:`, error.message);
                errorCount++;
            }
        }

        connection.release();

        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Migration Summary:');
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ Migrated: ${migratedCount}`);
        console.log(`⏭️  Skipped: ${skippedCount}`);
        console.log(`⚠️  Errors/Warnings: ${errorCount}`);
        console.log(`📝 Total: ${variantImages.length}`);
        console.log(`${'='.repeat(60)}\n`);

        if (migratedCount > 0) {
            console.log('✅ Migration completed successfully!\n');
        } else if (skippedCount === variantImages.length) {
            console.log('✅ All variant images already migrated!\n');
        } else {
            console.log('⚠️  Migration completed with warnings. Please review the log above.\n');
        }

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    migrateVariantImages()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

export default migrateVariantImages;
