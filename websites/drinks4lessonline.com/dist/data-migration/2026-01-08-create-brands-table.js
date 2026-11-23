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
class CreateBrandsTableMigration {
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
            console.log('\n🔄 Running migration: Create brands table...\n');
            if (!this.connection) {
                await this.connect();
            }
            const [tables] = await this.connection.query(`SHOW TABLES LIKE 'brands'`);
            if (tables.length > 0) {
                console.log('⚠️  Migration already applied (brands table exists)');
                return {
                    success: true,
                    message: 'Migration already applied'
                };
            }
            await this.connection.query(`
        CREATE TABLE brands (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          logo_url VARCHAR(500),
          website_url VARCHAR(500),
          is_featured BOOLEAN DEFAULT FALSE,
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          meta_title VARCHAR(255),
          meta_description TEXT,
          meta_keywords VARCHAR(500),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_slug (slug),
          INDEX idx_featured (is_featured),
          INDEX idx_active (is_active),
          INDEX idx_display_order (display_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
            console.log('  ✓ Created: brands table');
            await this.connection.query(`
        ALTER TABLE products
        ADD COLUMN brand_id INT NULL AFTER category_id,
        ADD INDEX idx_brand (brand_id),
        ADD CONSTRAINT fk_products_brand 
          FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
      `);
            console.log('  ✓ Added: brand_id column to products table');
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Successfully created brands table'
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
            console.log('\n🔄 Rolling back migration: Create brands table...\n');
            if (!this.connection) {
                await this.connect();
            }
            await this.connection.query(`
        ALTER TABLE products
        DROP FOREIGN KEY IF EXISTS fk_products_brand,
        DROP INDEX IF EXISTS idx_brand,
        DROP COLUMN IF EXISTS brand_id
      `);
            console.log('  ✓ Removed: brand_id from products table');
            await this.connection.query(`DROP TABLE IF EXISTS brands`);
            console.log('  ✓ Dropped: brands table');
            console.log('\n✅ Rollback completed successfully!\n');
            return {
                success: true,
                message: 'Successfully rolled back brands table'
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
        finally {
            if (this.connection) {
                this.connection.release();
            }
        }
    }
}
if (require.main === module) {
    const migration = new CreateBrandsTableMigration();
    const command = process.argv[2] || 'run';
    (async () => {
        try {
            if (command === 'rollback') {
                const result = await migration.rollback();
                process.exit(result.success ? 0 : 1);
            }
            else {
                const result = await migration.run();
                process.exit(result.success ? 0 : 1);
            }
        }
        catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}
exports.default = CreateBrandsTableMigration;
//# sourceMappingURL=2026-01-08-create-brands-table.js.map