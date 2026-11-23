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
class PerformanceIndexesMigration {
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
            console.log('\n🔄 Running migration: Add performance indexes...\n');
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Database User: ${database_config_1.dbConfig.user}`);
            console.log(`  Database Host: ${database_config_1.dbConfig.host}`);
            if (!this.connection) {
                await this.connect();
            }
            try {
                await this.connection.query(`
          CREATE INDEX idx_cart_items_lookup 
          ON cart_items (cart_id, product_id, variant_id)
        `);
                console.log('  ✓ Created index: idx_cart_items_lookup on cart_items');
            }
            catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    console.log('  ⚠️  Index idx_cart_items_lookup already exists');
                }
                else {
                    throw error;
                }
            }
            try {
                await this.connection.query(`
          CREATE INDEX idx_product_variants_lookup 
          ON product_variants (product_id, is_active)
        `);
                console.log('  ✓ Created index: idx_product_variants_lookup on product_variants');
            }
            catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    console.log('  ⚠️  Index idx_product_variants_lookup already exists');
                }
                else {
                    throw error;
                }
            }
            try {
                await this.connection.query(`
          CREATE INDEX idx_products_price 
          ON products (price)
        `);
                console.log('  ✓ Created index: idx_products_price on products');
            }
            catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    console.log('  ⚠️  Index idx_products_price already exists');
                }
                else {
                    throw error;
                }
            }
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Successfully added performance indexes'
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
            console.log('\n🔄 Rolling back migration: Add performance indexes...\n');
            if (!this.connection) {
                await this.connect();
            }
            try {
                await this.connection.query('DROP INDEX idx_cart_items_lookup ON cart_items');
                console.log('  ✓ Dropped index: idx_cart_items_lookup');
            }
            catch (e) {
                console.log('  ⚠️  Could not drop idx_cart_items_lookup');
            }
            try {
                await this.connection.query('DROP INDEX idx_product_variants_lookup ON product_variants');
                console.log('  ✓ Dropped index: idx_product_variants_lookup');
            }
            catch (e) {
                console.log('  ⚠️  Could not drop idx_product_variants_lookup');
            }
            try {
                await this.connection.query('DROP INDEX idx_products_price ON products');
                console.log('  ✓ Dropped index: idx_products_price');
            }
            catch (e) {
                console.log('  ⚠️  Could not drop idx_products_price');
            }
            console.log('\n✅ Rollback completed successfully!\n');
            return {
                success: true,
                message: 'Successfully rolled back performance indexes'
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
    const migration = new PerformanceIndexesMigration();
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
exports.default = PerformanceIndexesMigration;
//# sourceMappingURL=2026-01-28-performance-indexes.js.map