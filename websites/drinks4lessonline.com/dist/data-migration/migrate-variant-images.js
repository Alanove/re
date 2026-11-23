"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv_1.default.config({ path: envPath });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const database_1 = require("../src/config/database");
async function migrateVariantImages() {
    console.log('🔄 Starting variant image migration...\n');
    try {
        const connection = await database_1.db.getConnection();
        const [variantImages] = await connection.query(`
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
        const [attributeTypes] = await connection.query(`
      SELECT id, name, has_image 
      FROM variant_types 
      WHERE has_image = TRUE
    `);
        const imageAttributeNames = new Set(attributeTypes.map((at) => at.name.toLowerCase()));
        console.log(`Attribute types that support images: ${Array.from(imageAttributeNames).join(', ')}\n`);
        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        for (const variantImage of variantImages) {
            try {
                const attributes = JSON.parse(variantImage.attributes);
                let imageMigrated = false;
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    if (imageAttributeNames.has(attrName.toLowerCase())) {
                        const [valueRows] = await connection.query(`
              SELECT vtv.id, vtv.image_url
              FROM variant_type_values vtv
              JOIN variant_types vt ON vtv.variant_type_id = vt.id
              WHERE vt.name = ? AND vtv.value = ?
            `, [attrName, attrValue]);
                        if (valueRows.length > 0) {
                            const valueId = valueRows[0].id;
                            const existingImage = valueRows[0].image_url;
                            if (!existingImage) {
                                await connection.query(`
                  UPDATE variant_type_values 
                  SET image_url = ? 
                  WHERE id = ?
                `, [variantImage.image_url, valueId]);
                                console.log(`✅ Migrated: ${attrName}="${attrValue}" -> ${variantImage.image_url}`);
                                migratedCount++;
                                imageMigrated = true;
                            }
                            else {
                                console.log(`⏭️  Skipped: ${attrName}="${attrValue}" (already has image: ${existingImage})`);
                                skippedCount++;
                                imageMigrated = true;
                            }
                        }
                        else {
                            console.log(`⚠️  Warning: Could not find attribute value for ${attrName}="${attrValue}"`);
                            errorCount++;
                        }
                        break;
                    }
                }
                if (!imageMigrated) {
                    console.log(`⚠️  Warning: Variant "${variantImage.variant_name}" has no image-supporting attributes`);
                    errorCount++;
                }
            }
            catch (error) {
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
        }
        else if (skippedCount === variantImages.length) {
            console.log('✅ All variant images already migrated!\n');
        }
        else {
            console.log('⚠️  Migration completed with warnings. Please review the log above.\n');
        }
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        await database_1.db.close();
    }
}
if (require.main === module) {
    migrateVariantImages()
        .then(() => process.exit(0))
        .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
exports.default = migrateVariantImages;
//# sourceMappingURL=migrate-variant-images.js.map