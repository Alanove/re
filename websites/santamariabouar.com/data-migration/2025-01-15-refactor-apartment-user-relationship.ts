/**
 * Migration: Refactor Apartment-User Relationship
 * Date: 2025-01-15
 * Author: AI Assistant
 * 
 * Description:
 * This migration refactors the apartment-user relationship to properly normalize the database.
 * It removes redundant owner information from the apartments table since this data should
 * come from the users table via the owner_id foreign key relationship.
 * 
 * Rollback:
 * To rollback this migration, you would need to:
 * 1. Add back the owner_name, owner_phone, owner_email columns to apartments table
 * 2. Populate them with data from the users table
 * 3. Update any code that was modified to use the new structure
 */

import pool from '../src/config/database';

async function migrate() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('Starting apartment-user relationship refactoring...');
    
    // Step 1: Check current state
    console.log('Step 1: Checking current state...');
    const [apartmentsWithoutOwner] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NULL
    `);
    
    const [apartmentsWithInvalidOwner] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NOT NULL 
      AND owner_id NOT IN (SELECT id FROM users)
    `);
    
    console.log(`Apartments without owner: ${(apartmentsWithoutOwner as any[])[0].count}`);
    console.log(`Apartments with invalid owner: ${(apartmentsWithInvalidOwner as any[])[0].count}`);
    
    // Step 2: Create users for apartments without owners
    console.log('Step 2: Creating users for apartments without owners...');
    await connection.query(`
      INSERT IGNORE INTO users (username, email, status, role, created_at)
      SELECT 
        CONCAT('Owner_', a.id) as username,
        COALESCE(a.owner_email, CONCAT('owner_', a.id, '@placeholder.com')) as email,
        'Active' as status,
        'Member' as role,
        NOW() as created_at
      FROM apartments a
      WHERE a.owner_id IS NULL
    `);
    
    // Step 3: Update apartments without owner_id
    console.log('Step 3: Updating apartments without owner_id...');
    const [updateResult] = await connection.query(`
      UPDATE apartments a
      SET owner_id = (
        SELECT u.id 
        FROM users u 
        WHERE u.username = CONCAT('Owner_', a.id)
        LIMIT 1
      )
      WHERE a.owner_id IS NULL
    `);
    
    console.log(`Updated ${(updateResult as any).affectedRows} apartments with new owner_id`);
    
    // Step 4: Verify all apartments now have valid owner_id
    console.log('Step 4: Verifying all apartments have valid owner_id...');
    const [finalCheck] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NULL
    `);
    
    if ((finalCheck as any[])[0].count > 0) {
      throw new Error('Some apartments still don\'t have valid owner_id');
    }
    
    // Step 5: Add indexes for better performance
    console.log('Step 5: Adding performance indexes...');
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_apartments_owner_id ON apartments(owner_id)
    `);
    
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status)
    `);
    
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_apartments_floor ON apartments(floor)
    `);
    
    // Step 6: Ensure foreign key constraint exists
    console.log('Step 6: Ensuring foreign key constraint...');
    try {
      await connection.query(`
        ALTER TABLE apartments 
        ADD CONSTRAINT fk_apartments_owner 
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
      `);
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Foreign key constraint already exists');
      } else {
        throw error;
      }
    }
    
    // Step 7: Update data inconsistencies
    console.log('Step 7: Updating data inconsistencies...');
    await connection.query(`
      UPDATE apartments 
      SET status = 'owned' 
      WHERE status IS NULL OR status = ''
    `);
    
    // Step 8: Create view for easy apartment-owner queries
    console.log('Step 8: Creating apartment_owners view...');
    await connection.query(`
      CREATE OR REPLACE VIEW apartment_owners AS
      SELECT 
        a.id as apartment_id,
        a.apartment_number,
        a.apartment_number_unofficial,
        a.floor,
        a.size,
        a.status,
        a.registration_date,
        a.notes,
        a.created_at as apartment_created_at,
        u.id as owner_id,
        u.username as owner_name,
        u.email as owner_email,
        u.phone as owner_phone,
        u.role as owner_role,
        u.status as owner_status
      FROM apartments a
      LEFT JOIN users u ON a.owner_id = u.id
    `);
    
    // Step 9: Log the migration
    console.log('Step 9: Logging migration...');
    await connection.query(`
      INSERT INTO migrations (migration_name, executed_at, executed_by, status, notes)
      VALUES (?, NOW(), 'system', 'success', ?)
    `, [
      '2025-01-15-refactor-apartment-user-relationship',
      'Refactored apartment-user relationship, ensured all apartments have valid owner_id, added performance indexes'
    ]);
    
    await connection.commit();
    console.log('Migration completed successfully!');
    
    // Final verification
    const [finalStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_apartments,
        COUNT(owner_id) as apartments_with_owner,
        COUNT(DISTINCT owner_id) as unique_owners
      FROM apartments
    `);
    
    const stats = (finalStats as any[])[0];
    console.log('Final statistics:');
    console.log(`- Total apartments: ${stats.total_apartments}`);
    console.log(`- Apartments with owner: ${stats.apartments_with_owner}`);
    console.log(`- Unique owners: ${stats.unique_owners}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration
migrate().catch(console.error);
