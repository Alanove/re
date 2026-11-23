/**
 * Database Migration: Add Attribute Value Images Support
 * 
 * This migration adds support for attribute value images by:
 * 1. Adding image_url column to variant_type_values table
 * 2. Creating product_attributes junction table
 * 
 * Run: npx ts-node data-migration/add-attribute-value-images.ts
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

interface MigrationResult {
    success: boolean;
    message: string;
    error?: string;
}

class AttributeValueImagesMigration {
    async up(): Promise<MigrationResult> {
        try {
            const connection = await db.getConnection();

            console.log('🚀 Starting Attribute Value Images Migration...\n');

            // Step 1: Add image_url column to variant_type_values
            console.log('📝 Adding image_url column to variant_type_values...');
            try {
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN image_url VARCHAR(500) NULL 
          COMMENT 'Image for this attribute value (e.g., color swatch)'
        `);
                console.log('✅ Added image_url column\n');
            } catch (error: any) {
                if (error.message.includes('Duplicate column name')) {
                    console.log('⏭️  Column image_url already exists, skipping\n');
                } else {
                    throw error;
                }
            }

            // Step 2: Verify color_code column exists (should already exist based on code review)
            console.log('📝 Checking color_code column...');
            const [columns] = await connection.query(`
        SHOW COLUMNS FROM variant_type_values LIKE 'color_code'
      `);
            if ((columns as any[]).length === 0) {
                console.log('⚠️  Adding missing color_code column...');
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN color_code VARCHAR(50) NULL 
          COMMENT 'Hex color code for color attributes'
        `);
                console.log('✅ Added color_code column\n');
            } else {
                console.log('✅ color_code column exists\n');
            }

            // Step 3: Verify is_preselected column exists
            console.log('📝 Checking is_preselected column...');
            const [preselectedColumns] = await connection.query(`
        SHOW COLUMNS FROM variant_type_values LIKE 'is_preselected'
      `);
            if ((preselectedColumns as any[]).length === 0) {
                console.log('⚠️  Adding missing is_preselected column...');
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN is_preselected BOOLEAN DEFAULT FALSE 
          COMMENT 'Whether this value should be preselected in UI'
        `);
                console.log('✅ Added is_preselected column\n');
            } else {
                console.log('✅ is_preselected column exists\n');
            }

            // Step 4: Create product_attributes junction table
            console.log('📝 Creating product_attributes junction table...');
            await connection.query(`
        CREATE TABLE IF NOT EXISTS product_attributes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          variant_type_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE,
          UNIQUE KEY unique_product_attribute (product_id, variant_type_id),
          INDEX idx_product (product_id),
          INDEX idx_variant_type (variant_type_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
            console.log('✅ Created product_attributes table\n');

            // Verify changes
            console.log('🔍 Verifying schema changes...');
            const [vtv_columns] = await connection.query(`DESCRIBE variant_type_values`);
            console.log('\nvariant_type_values columns:');
            (vtv_columns as any[]).forEach((col: any) => {
                if (['image_url', 'color_code', 'is_preselected'].includes(col.Field)) {
                    console.log(`  ✓ ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
                }
            });

            const [pa_tables] = await connection.query(`SHOW TABLES LIKE 'product_attributes'`);
            if ((pa_tables as any[]).length > 0) {
                console.log('  ✓ product_attributes table exists');
            }

            connection.release();

            console.log('\n✅ Migration completed successfully!\n');

            return {
                success: true,
                message: 'Attribute value images schema created successfully'
            };
        } catch (error: any) {
            console.error('❌ Migration failed:', error);
            return {
                success: false,
                message: 'Migration failed',
                error: error.message
            };
        }
    }

    async down(): Promise<MigrationResult> {
        try {
            const connection = await db.getConnection();

            console.log('🔄 Rolling back Attribute Value Images Migration...\n');

            // Drop product_attributes table
            await connection.query('DROP TABLE IF EXISTS product_attributes');
            console.log('  ✓ Dropped: product_attributes');

            // Remove image_url column
            try {
                await connection.query('ALTER TABLE variant_type_values DROP COLUMN image_url');
                console.log('  ✓ Removed: image_url column');
            } catch (error: any) {
                if (!error.message.includes("Can't DROP")) {
                    throw error;
                }
            }

            connection.release();

            console.log('\n✅ Rollback completed successfully!\n');

            return {
                success: true,
                message: 'Migration rolled back successfully'
            };
        } catch (error: any) {
            console.error('❌ Rollback failed:', error);
            return {
                success: false,
                message: 'Rollback failed',
                error: error.message
            };
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new AttributeValueImagesMigration();
    const command = process.argv[2];

    if (command === 'down') {
        migration.down()
            .then(result => {
                process.exit(result.success ? 0 : 1);
            })
            .catch(err => {
                console.error('Error:', err);
                process.exit(1);
            });
    } else {
        migration.up()
            .then(result => {
                process.exit(result.success ? 0 : 1);
            })
            .catch(err => {
                console.error('Error:', err);
                process.exit(1);
            });
    }
}

export default AttributeValueImagesMigration;
