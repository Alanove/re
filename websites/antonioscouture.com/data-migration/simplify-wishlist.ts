import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

import { db } from '../src/config/database';

async function migrate() {
    try {
        console.log('🚀 Starting migration: Simplify wishlist table...\n');

        // Drop old unique indexes
        try {
            await db.query('ALTER TABLE wishlists DROP INDEX unique_wishlist_customer');
            console.log('  ✓ Dropped unique_wishlist_customer index');
        } catch (e: any) {
            console.log('  ⚠️  Could not drop unique_wishlist_customer (might not exist)');
        }

        try {
            await db.query('ALTER TABLE wishlists DROP INDEX unique_wishlist_session');
            console.log('  ✓ Dropped unique_wishlist_session index');
        } catch (e: any) {
            console.log('  ⚠️  Could not drop unique_wishlist_session (might not exist)');
        }

        // Create new unique indexes without variant_id
        try {
            await db.query('CREATE UNIQUE INDEX unique_wishlist_customer ON wishlists (customer_id, product_id)');
            console.log('  ✓ Created unique_wishlist_customer index (customer_id, product_id)');
        } catch (e: any) {
            console.log('  ⚠️  Could not create unique_wishlist_customer:', e.message);
        }

        try {
            await db.query('CREATE UNIQUE INDEX unique_wishlist_session ON wishlists (session_id, product_id)');
            console.log('  ✓ Created unique_wishlist_session index (session_id, product_id)');
        } catch (e: any) {
            console.log('  ⚠️  Could not create unique_wishlist_session:', e.message);
        }

        // Optional: Remove variant_id column data (set to NULL)
        try {
            await db.query('UPDATE wishlists SET variant_id = NULL');
            console.log('  ✓ Cleared variant_id data from wishlists');
        } catch (e: any) {
            console.log('  ⚠️  Could not clear variant_id:', e.message);
        }

        console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function run(): Promise<void> {
    await migrate();
}

export default run;

if (require.main === module) {
    run()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
