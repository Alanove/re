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
class AddPasswordResetToUsersMigration {
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
            console.log('\n🔄 Running migration: Add password reset columns to users table...\n');
            if (!this.connection) {
                await this.connect();
            }
            const [columns] = await this.connection.query(`SHOW COLUMNS FROM users LIKE 'reset_password_token'`);
            if (columns.length > 0) {
                console.log('⚠️  Migration already applied (columns exist)');
                return {
                    success: true,
                    message: 'Migration already applied'
                };
            }
            await this.connection.query(`
        ALTER TABLE users
        ADD COLUMN reset_password_token VARCHAR(255) NULL AFTER role,
        ADD COLUMN reset_password_expires DATETIME NULL AFTER reset_password_token,
        ADD INDEX idx_reset_token (reset_password_token)
      `);
            console.log('  ✓ Added: reset_password_token and reset_password_expires columns to users table');
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Successfully added password reset columns'
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
            console.log('\n🔄 Rolling back migration: Remove password reset columns...\n');
            if (!this.connection) {
                await this.connect();
            }
            await this.connection.query(`
        ALTER TABLE users
        DROP INDEX IF EXISTS idx_reset_token,
        DROP COLUMN IF EXISTS reset_password_expires,
        DROP COLUMN IF EXISTS reset_password_token
      `);
            console.log('  ✓ Removed: reset_password_token and reset_password_expires from users table');
            console.log('\n✅ Rollback completed successfully!\n');
            return {
                success: true,
                message: 'Successfully rolled back password reset columns'
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
    const migration = new AddPasswordResetToUsersMigration();
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
exports.default = AddPasswordResetToUsersMigration;
//# sourceMappingURL=2026-01-24-add-password-reset-to-users.js.map