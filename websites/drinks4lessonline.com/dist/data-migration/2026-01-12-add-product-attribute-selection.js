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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('Loaded env for:', nodeEnv);
class AddProductAttributeSelectionMigration {
    constructor() {
        this.connection = null;
        this.db = require('../src/config/database').db;
    }
    async up() {
        try {
            this.connection = await this.db.getConnection();
            if (!this.connection)
                throw new Error('Failed to get connection');
            console.log('🚀 Starting migration: Add selected_values to product_attributes...\n');
            await this.connection.query(`
        CREATE TABLE IF NOT EXISTS product_attributes (
          product_id INT NOT NULL,
          variant_type_id INT NOT NULL,
          PRIMARY KEY (product_id, variant_type_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
            console.log('  ✓ Verified: product_attributes table');
            try {
                await this.connection.query(`
          ALTER TABLE product_attributes
          ADD COLUMN selected_values JSON NULL COMMENT 'Array of selected value IDs'
        `);
                console.log('  ✓ Added column: selected_values');
            }
            catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log('  ⚠️  Column selected_values already exists');
                }
                else {
                    throw err;
                }
            }
            console.log('\n✅ Migration completed successfully!\n');
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }
        finally {
            if (this.connection) {
                this.connection.release();
            }
            process.exit(0);
        }
    }
}
new AddProductAttributeSelectionMigration().up();
//# sourceMappingURL=2026-01-12-add-product-attribute-selection.js.map