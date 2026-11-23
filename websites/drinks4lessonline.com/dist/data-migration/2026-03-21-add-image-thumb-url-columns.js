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
dotenv_1.default.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const promise_1 = __importDefault(require("mysql2/promise"));
const database_config_1 = require("../src/config/database.config");
class AddImageThumbUrlColumnsMigration {
    constructor() {
        this.connection = null;
    }
    async connect() {
        const pool = promise_1.default.createPool({
            ...database_config_1.dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
        this.connection = await pool.getConnection();
        console.log('✓ Connected to database');
    }
    async run() {
        try {
            console.log('\n🔄 Running migration: Add thumb_url columns for images...\n');
            if (!this.connection) {
                await this.connect();
            }
            const conn = this.connection;
            const addColumn = async (table, column, after) => {
                const [cols] = await conn.query(`SHOW COLUMNS FROM ${table} WHERE Field = ?`, [column]);
                if (cols.length > 0) {
                    console.log(`  ⚠️  ${table}.${column} already exists — skip`);
                    return;
                }
                const afterClause = after ? ` AFTER ${after}` : '';
                await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} VARCHAR(512) NULL${afterClause}`);
                console.log(`  ✓ Added: ${table}.${column}`);
            };
            await addColumn('product_images', 'thumb_url', 'image_url');
            await addColumn('product_categories', 'thumb_url', 'image_url');
            await addColumn('variant_type_values', 'thumb_url', 'image_url');
            console.log('\n✅ Migration completed successfully!\n');
            return { success: true, message: 'thumb_url columns added' };
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            return { success: false, message: 'Migration failed', error: error.message };
        }
        finally {
            if (this.connection) {
                this.connection.release();
            }
        }
    }
}
if (require.main === module) {
    const migration = new AddImageThumbUrlColumnsMigration();
    (async () => {
        const result = await migration.run();
        process.exit(result.success ? 0 : 1);
    })();
}
exports.default = AddImageThumbUrlColumnsMigration;
//# sourceMappingURL=2026-03-21-add-image-thumb-url-columns.js.map