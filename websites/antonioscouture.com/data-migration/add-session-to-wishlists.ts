
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(__dirname, '..', envFile);
const rootEnvPath = path.resolve(__dirname, '..', '.env');

console.log('Loading env from:', rootEnvPath);

// Load env vars BEFORE importing database
console.log('Expected env path:', envPath);
const result1 = dotenv.config({ path: envPath });
const result2 = dotenv.config({ path: rootEnvPath });

if (result1.parsed) {
    console.log('Successfully parsed .env.development keys:', Object.keys(result1.parsed));
    // Verify assignment/Force assignment if needed (standard dotenv does this, but being explicit helps debug)
    console.log('Checking process.env.DB_USER after load:', process.env.DB_USER);
} else {
    console.log('Failed to parse .env.development (result1.parsed is empty)');
}

console.log('Loaded env result for ' + envFile + ':', result1.error ? result1.error.message : 'Success');
console.log('Loaded env result for .env:', result2.error ? result2.error.message : 'Failed (Expected if file missing)');

console.log('DB Config check:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

// Dynamic import of database to ensure env vars are loaded first
// We need to use require here because we are in a node environment checking execution order
// or we can use dynamic import().

import * as mysql from 'mysql2/promise';

class AddSessionToWishlistsMigration {
  private connection: mysql.PoolConnection | null = null;
  private db: any = null;

  async up(): Promise<void> {
    try {
      // Import db here to ensure env vars are picked up
      const { db } = await import('../src/config/database');
      this.db = db;

      this.connection = await this.db.getConnection();
      if (!this.connection) throw new Error('Failed to get connection');
      
      console.log('🚀 Starting migration: Add session_id to wishlists...\n');

      // 1. Drop existing unique index
      try {
        await this.connection!.query('ALTER TABLE wishlists DROP INDEX unique_wishlist');
        console.log('  ✓ Dropped unique_wishlist index');
      } catch (e: any) {
        console.log('  ⚠️  Could not drop unique_wishlist index (might not exist or different name)');
      }

      // 2. Modify customer_id to be nullable
      await this.connection.query('ALTER TABLE wishlists MODIFY COLUMN customer_id INT NULL');
      console.log('  ✓ Modified customer_id to be nullable');

      // 3. Add session_id column
      try {
        await this.connection.query('ALTER TABLE wishlists ADD COLUMN session_id VARCHAR(255) NULL AFTER customer_id');
        console.log('  ✓ Added session_id column');
      } catch (e: any) {
         if (e.code === 'ER_DUP_FIELDNAME') {
             console.log('  ⚠️  session_id column already exists');
         } else {
             throw e;
         }
      }

      // 4. Add index for session_id
      try {
        await this.connection.query('CREATE INDEX idx_session ON wishlists(session_id)');
        console.log('  ✓ Added index for session_id');
      } catch (e: any) {
         if (e.code === 'ER_DUP_KEYNAME') {
            console.log('  ⚠️  idx_session already exists');
         } else {
            throw e;
         }
      }

      // 5. Re-create unique constraint
      try {
          await this.connection.query('CREATE UNIQUE INDEX unique_wishlist_customer ON wishlists (customer_id, product_id, variant_id)');
          console.log('  ✓ Created unique_wishlist_customer index');
      } catch (e: any) {
          console.log('  ⚠️  Could not create unique_wishlist_customer index:', e.message);
      }

      try {
          await this.connection.query('CREATE UNIQUE INDEX unique_wishlist_session ON wishlists (session_id, product_id, variant_id)');
          console.log('  ✓ Created unique_wishlist_session index');
      } catch (e: any) {
          console.log('  ⚠️  Could not create unique_wishlist_session index:', e.message);
      }

      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }
}

export default AddSessionToWishlistsMigration;

// Run migration
if (require.main === module) {
  const migration = new AddSessionToWishlistsMigration();
  migration.up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
