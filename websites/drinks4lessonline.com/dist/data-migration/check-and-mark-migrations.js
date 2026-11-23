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
const fs = __importStar(require("fs"));
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv_1.default.config({ path: envPath });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const database_1 = require("../src/config/database");
const database_config_1 = require("../src/config/database.config");
const MIGRATIONS_TABLE = '_migrations';
const DATA_MIGRATION_DIR = path.join(__dirname);
async function tableExists(tableName) {
    const [rows] = await database_1.db.query(`SHOW TABLES LIKE ?`, [tableName]);
    return (rows || []).length > 0;
}
async function columnExists(table, column) {
    const [rows] = await database_1.db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    return (rows || []).length > 0;
}
async function tableHasRow(table) {
    const [rows] = await database_1.db.query(`SELECT 1 FROM \`${table}\` LIMIT 1`);
    return (rows || []).length > 0;
}
async function indexExists(table, indexName) {
    const dbName = database_config_1.dbConfig.database;
    const [rows] = await database_1.db.query(`SELECT INDEX_NAME AS Key_name FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`, [dbName, table, indexName]);
    return (rows || []).length > 0;
}
const MIGRATION_CHECKS = {
    '2025-01-15-ecommerce-schema.ts': () => tableExists('products'),
    '2025-01-15-init-payment-methods.ts': () => tableHasRow('payment_methods'),
    '2025-01-16-variant-types.ts': () => tableExists('variant_types'),
    '2026-01-07-enhance-variant-values.ts': () => columnExists('variant_type_values', 'color_code'),
    '2026-01-08-create-brands-table.ts': () => tableExists('brands'),
    '2026-01-12-add-product-attribute-selection.ts': () => columnExists('product_attributes', 'selected_values'),
    '2026-01-16-add-image-to-variant-values.ts': () => columnExists('variant_type_values', 'image_url'),
    '2026-01-16-enhance-product-relations.ts': () => tableExists('product_categories_map'),
    '2026-01-24-add-password-reset-to-users.ts': () => columnExists('users', 'reset_password_token'),
    '2026-01-25-add-discount-to-cart.ts': () => columnExists('shopping_carts', 'discount_code'),
    '2026-01-25-encrypt-customer-addresses.ts': () => columnExists('customer_addresses', 'content_encrypted'),
    '2026-01-28-performance-indexes.ts': () => indexExists('cart_items', 'idx_cart_items_lookup'),
    '2026-01-31-newsletter-subscribers.ts': () => tableExists('newsletter_subscribers'),
    'add-attribute-value-images.ts': () => tableExists('product_attributes'),
    'add-session-to-wishlists.ts': () => columnExists('wishlists', 'session_id'),
    'simplify-wishlist.ts': () => indexExists('wishlists', 'unique_wishlist_customer'),
    '2026-04-26-add-slider-duration-seconds.ts': () => columnExists('slider', 'duration_seconds'),
    '2026-04-28-ensure-slider-duration-seconds.ts': () => columnExists('slider', 'duration_seconds'),
};
async function ensureMigrationsTable() {
    await database_1.db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
async function getAppliedMigrations() {
    const [rows] = await database_1.db.query(`SELECT migration_name FROM ${MIGRATIONS_TABLE}`);
    return new Set((rows || []).map((r) => r.migration_name));
}
function getMigrationFiles() {
    const files = fs.readdirSync(DATA_MIGRATION_DIR);
    return files
        .filter((f) => f.endsWith('.ts') && f !== 'run-migrations.ts' && f !== 'check-and-mark-migrations.ts')
        .sort();
}
async function run() {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = getMigrationFiles();
    console.log('Checking database for applied migrations...\n');
    let marked = 0;
    const noCheck = [];
    const failed = [];
    const skipped = [];
    for (const filename of files) {
        if (applied.has(filename)) {
            skipped.push(filename);
            continue;
        }
        const check = MIGRATION_CHECKS[filename];
        if (!check) {
            noCheck.push(filename);
            continue;
        }
        try {
            const detected = await check();
            if (detected) {
                await database_1.db.query(`INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`, [filename]);
                console.log(`  ✓ Marked applied (detected): ${filename}`);
                marked++;
                applied.add(filename);
            }
        }
        catch (err) {
            failed.push(filename);
            console.warn(`  ✗ Check failed for ${filename}:`, err.message);
        }
    }
    console.log('');
    console.log(`Marked ${marked} migration(s) as applied.`);
    if (noCheck.length > 0) {
        console.log(`No check defined (mark manually if needed): ${noCheck.join(', ')}`);
    }
    if (failed.length > 0) {
        console.log(`Check failed (review manually): ${failed.join(', ')}`);
    }
    if (skipped.length > 0) {
        console.log(`Already in _migrations (skipped): ${skipped.length} migration(s).`);
    }
    console.log('');
    process.exit(0);
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=check-and-mark-migrations.js.map