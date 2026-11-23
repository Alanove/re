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
class AttributeValueImagesMigration {
    async up() {
        try {
            const connection = await database_1.db.getConnection();
            console.log('🚀 Starting Attribute Value Images Migration...\n');
            console.log('📝 Adding image_url column to variant_type_values...');
            try {
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN image_url VARCHAR(500) NULL 
          COMMENT 'Image for this attribute value (e.g., color swatch)'
        `);
                console.log('✅ Added image_url column\n');
            }
            catch (error) {
                if (error.message.includes('Duplicate column name')) {
                    console.log('⏭️  Column image_url already exists, skipping\n');
                }
                else {
                    throw error;
                }
            }
            console.log('📝 Checking color_code column...');
            const [columns] = await connection.query(`
        SHOW COLUMNS FROM variant_type_values LIKE 'color_code'
      `);
            if (columns.length === 0) {
                console.log('⚠️  Adding missing color_code column...');
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN color_code VARCHAR(50) NULL 
          COMMENT 'Hex color code for color attributes'
        `);
                console.log('✅ Added color_code column\n');
            }
            else {
                console.log('✅ color_code column exists\n');
            }
            console.log('📝 Checking is_preselected column...');
            const [preselectedColumns] = await connection.query(`
        SHOW COLUMNS FROM variant_type_values LIKE 'is_preselected'
      `);
            if (preselectedColumns.length === 0) {
                console.log('⚠️  Adding missing is_preselected column...');
                await connection.query(`
          ALTER TABLE variant_type_values 
          ADD COLUMN is_preselected BOOLEAN DEFAULT FALSE 
          COMMENT 'Whether this value should be preselected in UI'
        `);
                console.log('✅ Added is_preselected column\n');
            }
            else {
                console.log('✅ is_preselected column exists\n');
            }
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
            console.log('🔍 Verifying schema changes...');
            const [vtv_columns] = await connection.query(`DESCRIBE variant_type_values`);
            console.log('\nvariant_type_values columns:');
            vtv_columns.forEach((col) => {
                if (['image_url', 'color_code', 'is_preselected'].includes(col.Field)) {
                    console.log(`  ✓ ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
                }
            });
            const [pa_tables] = await connection.query(`SHOW TABLES LIKE 'product_attributes'`);
            if (pa_tables.length > 0) {
                console.log('  ✓ product_attributes table exists');
            }
            connection.release();
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Attribute value images schema created successfully'
            };
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            return {
                success: false,
                message: 'Migration failed',
                error: error.message
            };
        }
    }
    async down() {
        try {
            const connection = await database_1.db.getConnection();
            console.log('🔄 Rolling back Attribute Value Images Migration...\n');
            await connection.query('DROP TABLE IF EXISTS product_attributes');
            console.log('  ✓ Dropped: product_attributes');
            try {
                await connection.query('ALTER TABLE variant_type_values DROP COLUMN image_url');
                console.log('  ✓ Removed: image_url column');
            }
            catch (error) {
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
        }
        catch (error) {
            console.error('❌ Rollback failed:', error);
            return {
                success: false,
                message: 'Rollback failed',
                error: error.message
            };
        }
    }
}
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
    }
    else {
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
exports.default = AttributeValueImagesMigration;
//# sourceMappingURL=add-attribute-value-images.js.map