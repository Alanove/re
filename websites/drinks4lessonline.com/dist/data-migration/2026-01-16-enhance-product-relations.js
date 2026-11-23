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
const promise_1 = __importDefault(require("mysql2/promise"));
const database_config_1 = require("../src/config/database.config");
class EnhanceProductRelationsMigration {
    constructor() {
        this.connection = null;
    }
    async connect() {
        const pool = promise_1.default.createPool({
            ...database_config_1.dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        this.connection = await pool.getConnection();
        console.log('✓ Connected to database');
    }
    async run() {
        try {
            console.log('\n🔄 Running migration: Enhance product relations (categories & image attributes)...\n');
            if (!this.connection) {
                await this.connect();
            }
            await this.connection.query(`
        CREATE TABLE IF NOT EXISTS product_categories_map (
            product_id INT NOT NULL,
            category_id INT NOT NULL,
            is_primary BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (product_id, category_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE,
            INDEX idx_product (product_id),
            INDEX idx_category (category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
            console.log('  ✓ Created: product_categories_map table');
            const [columns] = await this.connection.query(`SHOW COLUMNS FROM product_images WHERE Field = 'attribute_value_id'`);
            if (columns.length === 0) {
                await this.connection.query(`
          ALTER TABLE product_images
          ADD COLUMN attribute_value_id INT NULL COMMENT 'Link image to specific attribute value (e.g. Red)',
          ADD FOREIGN KEY (attribute_value_id) REFERENCES variant_type_values(id) ON DELETE SET NULL,
          ADD INDEX idx_attribute_value (attribute_value_id)
        `);
                console.log('  ✓ Added: attribute_value_id to product_images');
            }
            else {
                console.log('  ⚠️  attribute_value_id already exists in product_images');
            }
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Successfully enhanced product relations'
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
        finally {
            if (this.connection) {
                this.connection.release();
            }
        }
    }
    async rollback() {
        try {
            if (!this.connection) {
                await this.connect();
            }
            await this.connection.query(`DROP TABLE IF EXISTS product_categories_map`);
            const [columns] = await this.connection.query(`SHOW COLUMNS FROM product_images WHERE Field = 'attribute_value_id'`);
            if (columns.length > 0) {
                try {
                    await this.connection.query(`ALTER TABLE product_images DROP FOREIGN KEY product_images_ibfk_3`);
                }
                catch (e) { }
                await this.connection.query(`ALTER TABLE product_images DROP COLUMN attribute_value_id`);
            }
            return { success: true, message: 'Rolled back' };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }
}
if (require.main === module) {
    const migration = new EnhanceProductRelationsMigration();
    (async () => {
        try {
            const result = await migration.run();
            process.exit(result.success ? 0 : 1);
        }
        catch (err) {
            console.error(err);
            process.exit(1);
        }
    })();
}
exports.default = EnhanceProductRelationsMigration;
//# sourceMappingURL=2026-01-16-enhance-product-relations.js.map