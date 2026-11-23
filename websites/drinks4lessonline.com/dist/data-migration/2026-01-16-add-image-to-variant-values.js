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
class AddImageToVariantValuesMigration {
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
            console.log('\n🔄 Running migration: Add image_url to variant_type_values...\n');
            if (!this.connection) {
                await this.connect();
            }
            const [columns] = await this.connection.query(`SHOW COLUMNS FROM variant_type_values WHERE Field = 'image_url'`);
            if (columns.length > 0) {
                console.log('⚠️  Migration already applied (image_url exists)');
                return {
                    success: true,
                    message: 'Migration already applied'
                };
            }
            await this.connection.query(`
        ALTER TABLE variant_type_values
        ADD COLUMN image_url VARCHAR(500) NULL COMMENT 'URL for attribute value image (e.g. pattern swatch)'
        AFTER color_code
      `);
            console.log('  ✓ Added: image_url column');
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Successfully added image_url'
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
            await this.connection.query(`
        ALTER TABLE variant_type_values
        DROP COLUMN IF EXISTS image_url
      `);
            return { success: true, message: 'Rolled back successfully' };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
        finally {
            if (this.connection)
                this.connection.release();
        }
    }
}
if (require.main === module) {
    const migration = new AddImageToVariantValuesMigration();
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
exports.default = AddImageToVariantValuesMigration;
//# sourceMappingURL=2026-01-16-add-image-to-variant-values.js.map