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
class AddDiscountToCartMigration {
    constructor() {
        this.connection = null;
    }
    async up() {
        try {
            this.connection = await database_1.db.getConnection();
            console.log('🚀 Adding discount_code to shopping_carts table...\n');
            const query = `
        ALTER TABLE shopping_carts
        ADD COLUMN discount_code VARCHAR(255) NULL AFTER session_id
      `;
            try {
                await this.connection.query(query);
                console.log('  ✓ Updated: shopping_carts (added discount_code)');
            }
            catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
                    console.log('  ⚠️  Column discount_code already exists in shopping_carts');
                }
                else {
                    throw error;
                }
            }
            console.log('\n✅ Migration completed successfully!\n');
            return {
                success: true,
                message: 'Migration completed successfully'
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
    async down() {
        try {
            this.connection = await database_1.db.getConnection();
            console.log('🔄 Rolling back discount_code column...\n');
            const query = 'ALTER TABLE shopping_carts DROP COLUMN discount_code';
            try {
                await this.connection.query(query);
                console.log('  ✓ Updated: shopping_carts (dropped discount_code)');
            }
            catch (error) {
                if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log('  ⚠️  Column discount_code does not exist');
                }
                else {
                    throw error;
                }
            }
            console.log('\n✅ Rollback completed successfully!\n');
            return {
                success: true,
                message: 'Rollback completed successfully'
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
    const migration = new AddDiscountToCartMigration();
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
exports.default = AddDiscountToCartMigration;
//# sourceMappingURL=2026-01-25-add-discount-to-cart.js.map