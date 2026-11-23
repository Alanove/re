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
dotenv.config({ path: '.env.development' });
const database_1 = require("../src/config/database");
async function migrate() {
    try {
        console.log('🚀 Starting migration: Simplify wishlist table...\n');
        try {
            await database_1.db.query('ALTER TABLE wishlists DROP INDEX unique_wishlist_customer');
            console.log('  ✓ Dropped unique_wishlist_customer index');
        }
        catch (e) {
            console.log('  ⚠️  Could not drop unique_wishlist_customer (might not exist)');
        }
        try {
            await database_1.db.query('ALTER TABLE wishlists DROP INDEX unique_wishlist_session');
            console.log('  ✓ Dropped unique_wishlist_session index');
        }
        catch (e) {
            console.log('  ⚠️  Could not drop unique_wishlist_session (might not exist)');
        }
        try {
            await database_1.db.query('CREATE UNIQUE INDEX unique_wishlist_customer ON wishlists (customer_id, product_id)');
            console.log('  ✓ Created unique_wishlist_customer index (customer_id, product_id)');
        }
        catch (e) {
            console.log('  ⚠️  Could not create unique_wishlist_customer:', e.message);
        }
        try {
            await database_1.db.query('CREATE UNIQUE INDEX unique_wishlist_session ON wishlists (session_id, product_id)');
            console.log('  ✓ Created unique_wishlist_session index (session_id, product_id)');
        }
        catch (e) {
            console.log('  ⚠️  Could not create unique_wishlist_session:', e.message);
        }
        try {
            await database_1.db.query('UPDATE wishlists SET variant_id = NULL');
            console.log('  ✓ Cleared variant_id data from wishlists');
        }
        catch (e) {
            console.log('  ⚠️  Could not clear variant_id:', e.message);
        }
        console.log('\n✅ Migration completed successfully!\n');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
migrate();
//# sourceMappingURL=simplify-wishlist.js.map