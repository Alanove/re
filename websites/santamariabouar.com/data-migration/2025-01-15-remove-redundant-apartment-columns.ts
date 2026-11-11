/**
 * Migration: Remove Redundant Apartment Columns
 * Date: 2025-01-15
 * Author: AI Assistant
 * 
 * Description:
 * This migration removes the redundant owner_name, owner_phone, and owner_email columns
 * from the apartments table since this information should come from the users table
 * via the owner_id foreign key relationship.
 * 
 * IMPORTANT: This migration should only be run AFTER verifying that the apartment-user
 * relationship refactoring is working correctly and all functionality is preserved.
 * 
 * Rollback:
 * To rollback this migration, you would need to:
 * 1. Add back the owner_name, owner_phone, owner_email columns to apartments table
 * 2. Populate them with data from the users table using the owner_id relationship
 */

import pool from '../src/config/database';

async function migrate() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('Starting removal of redundant apartment columns...');
    
    // Step 1: Verify that all apartments have valid owner_id
    console.log('Step 1: Verifying all apartments have valid owner_id...');
    const [checkResult] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NULL
    `);
    
    if ((checkResult as any[])[0].count > 0) {
      throw new Error('Cannot proceed: Some apartments still don\'t have valid owner_id');
    }
    
    // Step 2: Verify that the apartment_owners view exists and works
    console.log('Step 2: Verifying apartment_owners view...');
    const [viewCheck] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartment_owners
      LIMIT 1
    `);
    console.log('apartment_owners view is working correctly');
    
    // Step 3: Backup the redundant data (just in case)
    console.log('Step 3: Creating backup of redundant data...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS apartments_backup_redundant_columns AS
      SELECT id, owner_name, owner_phone, owner_email
      FROM apartments
      WHERE owner_name IS NOT NULL OR owner_phone IS NOT NULL OR owner_email IS NOT NULL
    `);
    
    // Step 4: Remove redundant columns
    console.log('Step 4: Removing redundant columns...');
    
    // Check if columns exist before trying to drop them
    const [columnsCheck] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'apartments' 
      AND COLUMN_NAME IN ('owner_name', 'owner_phone', 'owner_email')
    `);
    
    const existingColumns = (columnsCheck as any[]).map(row => row.COLUMN_NAME);
    
    if (existingColumns.includes('owner_name')) {
      await connection.query(`ALTER TABLE apartments DROP COLUMN owner_name`);
      console.log('Dropped owner_name column');
    }
    
    if (existingColumns.includes('owner_phone')) {
      await connection.query(`ALTER TABLE apartments DROP COLUMN owner_phone`);
      console.log('Dropped owner_phone column');
    }
    
    if (existingColumns.includes('owner_email')) {
      await connection.query(`ALTER TABLE apartments DROP COLUMN owner_email`);
      console.log('Dropped owner_email column');
    }
    
    // Step 5: Verify the changes
    console.log('Step 5: Verifying changes...');
    const [finalCheck] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'apartments' 
      AND COLUMN_NAME IN ('owner_name', 'owner_phone', 'owner_email')
    `);
    
    if ((finalCheck as any[]).length > 0) {
      throw new Error('Some redundant columns still exist');
    }
    
    // Step 6: Test that apartment_owners view still works
    console.log('Step 6: Testing apartment_owners view...');
    const [viewTest] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartment_owners
    `);
    console.log(`apartment_owners view returns ${(viewTest as any[])[0].count} records`);
    
    // Step 7: Log the migration
    console.log('Step 7: Logging migration...');
    await connection.query(`
      INSERT INTO migrations (migration_name, executed_at, executed_by, status, notes)
      VALUES (?, NOW(), 'system', 'success', ?)
    `, [
      '2025-01-15-remove-redundant-apartment-columns',
      'Removed redundant owner_name, owner_phone, owner_email columns from apartments table. Data backed up in apartments_backup_redundant_columns table.'
    ]);
    
    await connection.commit();
    console.log('Migration completed successfully!');
    
    console.log('IMPORTANT NOTES:');
    console.log('- Redundant columns have been removed from apartments table');
    console.log('- Backup data is available in apartments_backup_redundant_columns table');
    console.log('- All apartment-owner data should now be accessed via the apartment_owners view or JOIN queries');
    console.log('- Please test all admin panel functionality to ensure everything works correctly');
    
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
