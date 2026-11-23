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
const envPath = path.resolve(__dirname, '..', envFile);
const rootEnvPath = path.resolve(__dirname, '..', '.env');
console.log('Loading env from:', rootEnvPath);
const result1 = dotenv.config({ path: envPath });
const result2 = dotenv.config({ path: rootEnvPath });
if (result1.parsed) {
    console.log('Successfully parsed .env.development keys:', Object.keys(result1.parsed));
    console.log('Checking process.env.DB_USER after load:', process.env.DB_USER);
}
else {
    console.log('Failed to parse .env.development (result1.parsed is empty)');
}
console.log('Loaded env result for ' + envFile + ':', result1.error ? result1.error.message : 'Success');
console.log('Loaded env result for .env:', result2.error ? result2.error.message : 'Failed (Expected if file missing)');
console.log('DB Config check:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
class AddSessionToWishlistsMigration {
    constructor() {
        this.connection = null;
        this.db = null;
    }
    async up() {
        try {
            const { db } = await Promise.resolve().then(() => __importStar(require('../src/config/database')));
            this.db = db;
            this.connection = await this.db.getConnection();
            if (!this.connection)
                throw new Error('Failed to get connection');
            console.log('🚀 Starting migration: Add session_id to wishlists...\n');
            try {
                await this.connection.query('ALTER TABLE wishlists DROP INDEX unique_wishlist');
                console.log('  ✓ Dropped unique_wishlist index');
            }
            catch (e) {
                console.log('  ⚠️  Could not drop unique_wishlist index (might not exist or different name)');
            }
            await this.connection.query('ALTER TABLE wishlists MODIFY COLUMN customer_id INT NULL');
            console.log('  ✓ Modified customer_id to be nullable');
            try {
                await this.connection.query('ALTER TABLE wishlists ADD COLUMN session_id VARCHAR(255) NULL AFTER customer_id');
                console.log('  ✓ Added session_id column');
            }
            catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log('  ⚠️  session_id column already exists');
                }
                else {
                    throw e;
                }
            }
            try {
                await this.connection.query('CREATE INDEX idx_session ON wishlists(session_id)');
                console.log('  ✓ Added index for session_id');
            }
            catch (e) {
                if (e.code === 'ER_DUP_KEYNAME') {
                    console.log('  ⚠️  idx_session already exists');
                }
                else {
                    throw e;
                }
            }
            try {
                await this.connection.query('CREATE UNIQUE INDEX unique_wishlist_customer ON wishlists (customer_id, product_id, variant_id)');
                console.log('  ✓ Created unique_wishlist_customer index');
            }
            catch (e) {
                console.log('  ⚠️  Could not create unique_wishlist_customer index:', e.message);
            }
            try {
                await this.connection.query('CREATE UNIQUE INDEX unique_wishlist_session ON wishlists (session_id, product_id, variant_id)');
                console.log('  ✓ Created unique_wishlist_session index');
            }
            catch (e) {
                console.log('  ⚠️  Could not create unique_wishlist_session index:', e.message);
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
        }
    }
}
if (require.main === module) {
    const migration = new AddSessionToWishlistsMigration();
    migration.up()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
//# sourceMappingURL=add-session-to-wishlists.js.map