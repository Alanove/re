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
class EncryptCustomerAddressesMigration {
    async up() {
        console.log('🔒 Starting Customer Addresses Encryption Migration...');
        try {
            const connection = await database_1.db.getConnection();
            const [columns] = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'ecommerce_db'}' 
         AND TABLE_NAME = 'customer_addresses' 
         AND COLUMN_NAME = 'content_encrypted'`);
            if (columns.length === 0) {
                await connection.query(`
          ALTER TABLE customer_addresses
          ADD COLUMN content_encrypted TEXT COMMENT 'Encrypted PII data',
          ADD COLUMN iv VARCHAR(255) COMMENT 'Initialization vector for encryption'
        `);
                console.log('  ✓ Added encrypted columns');
                await connection.query(`
          ALTER TABLE customer_addresses
          DROP COLUMN first_name,
          DROP COLUMN last_name,
          DROP COLUMN company,
          DROP COLUMN address_line_1,
          DROP COLUMN address_line_2,
          DROP COLUMN phone
        `);
                console.log('  ✓ Dropped plaintext PII columns');
            }
            else {
                console.log('  ⚠️  Columns already exist, skipping');
            }
            connection.release();
            console.log('✅ Customer Addresses Encryption Migration completed');
            return { success: true, message: 'Migration successful' };
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            return { success: false, message: error.message };
        }
    }
    async down() {
        console.log('REVERT NOT IMPLEMENTED FOR SAFETY (Would lose data)');
        return { success: false, message: 'Not implemented' };
    }
}
if (require.main === module) {
    const migration = new EncryptCustomerAddressesMigration();
    migration.up().then(() => process.exit(0)).catch(() => process.exit(1));
}
exports.default = EncryptCustomerAddressesMigration;
//# sourceMappingURL=2026-01-25-encrypt-customer-addresses.js.map