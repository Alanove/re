/**
 * Test Script: Apartment-User Relationship
 * 
 * This script tests the apartment-user relationship after migration
 * to ensure everything is working correctly.
 */

import pool from '../src/config/database';

async function testApartmentUserRelationship() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Testing apartment-user relationship...\n');
    
    // Test 1: Check that all apartments have valid owner_id
    console.log('Test 1: Checking apartments without owner_id...');
    const [apartmentsWithoutOwner] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NULL
    `);
    
    if ((apartmentsWithoutOwner as any[])[0].count > 0) {
      console.error('❌ FAIL: Some apartments still don\'t have owner_id');
      return false;
    } else {
      console.log('✅ PASS: All apartments have owner_id');
    }
    
    // Test 2: Check that all owner_id references valid users
    console.log('\nTest 2: Checking apartments with invalid owner_id...');
    const [apartmentsWithInvalidOwner] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartments 
      WHERE owner_id IS NOT NULL 
      AND owner_id NOT IN (SELECT id FROM users)
    `);
    
    if ((apartmentsWithInvalidOwner as any[])[0].count > 0) {
      console.error('❌ FAIL: Some apartments have invalid owner_id');
      return false;
    } else {
      console.log('✅ PASS: All apartments have valid owner_id');
    }
    
    // Test 3: Test the apartment_owners view
    console.log('\nTest 3: Testing apartment_owners view...');
    const [viewTest] = await connection.query(`
      SELECT COUNT(*) as count
      FROM apartment_owners
    `);
    
    const viewCount = (viewTest as any[])[0].count;
    console.log(`✅ PASS: apartment_owners view returns ${viewCount} records`);
    
    // Test 4: Check sample data from the view
    console.log('\nTest 4: Checking sample data from apartment_owners view...');
    const [sampleData] = await connection.query(`
      SELECT 
        apartment_id,
        apartment_number,
        floor,
        owner_id,
        owner_name,
        owner_email
      FROM apartment_owners
      LIMIT 5
    `);
    
    console.log('Sample apartment-owner data:');
    (sampleData as any[]).forEach((row: any) => {
      console.log(`  Apartment ${row.apartment_number} (${row.floor}) - Owner: ${row.owner_name} (${row.owner_email})`);
    });
    
    // Test 5: Check indexes exist
    console.log('\nTest 5: Checking performance indexes...');
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'apartments'
      AND INDEX_NAME IN ('idx_apartments_owner_id', 'idx_apartments_status', 'idx_apartments_floor')
    `);
    
    const indexNames = (indexes as any[]).map(row => row.INDEX_NAME);
    const expectedIndexes = ['idx_apartments_owner_id', 'idx_apartments_status', 'idx_apartments_floor'];
    
    for (const expectedIndex of expectedIndexes) {
      if (indexNames.includes(expectedIndex)) {
        console.log(`✅ PASS: Index ${expectedIndex} exists`);
      } else {
        console.log(`❌ FAIL: Index ${expectedIndex} missing`);
      }
    }
    
    // Test 6: Check foreign key constraint
    console.log('\nTest 6: Checking foreign key constraint...');
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'apartments'
      AND COLUMN_NAME = 'owner_id'
      AND REFERENCED_TABLE_NAME = 'users'
    `);
    
    if ((constraints as any[]).length > 0) {
      console.log('✅ PASS: Foreign key constraint exists');
    } else {
      console.log('❌ FAIL: Foreign key constraint missing');
    }
    
    // Test 7: Performance test - count apartments by owner
    console.log('\nTest 7: Performance test - counting apartments by owner...');
    const startTime = Date.now();
    const [apartmentCounts] = await connection.query(`
      SELECT 
        u.username,
        COUNT(a.id) as apartment_count
      FROM users u
      LEFT JOIN apartments a ON u.id = a.owner_id
      GROUP BY u.id, u.username
      ORDER BY apartment_count DESC
      LIMIT 10
    `);
    const endTime = Date.now();
    
    console.log(`✅ PASS: Query completed in ${endTime - startTime}ms`);
    console.log('Top 10 users by apartment count:');
    (apartmentCounts as any[]).forEach((row: any) => {
      console.log(`  ${row.username}: ${row.apartment_count} apartments`);
    });
    
    // Test 8: Check migration was logged
    console.log('\nTest 8: Checking migration logs...');
    const [migrations] = await connection.query(`
      SELECT migration_name, status, executed_at
      FROM migrations
      WHERE migration_name LIKE '%apartment-user%'
      ORDER BY executed_at DESC
    `);
    
    if ((migrations as any[]).length > 0) {
      console.log('✅ PASS: Migration was logged');
      (migrations as any[]).forEach((migration: any) => {
        console.log(`  ${migration.migration_name}: ${migration.status} at ${migration.executed_at}`);
      });
    } else {
      console.log('❌ FAIL: Migration was not logged');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  } finally {
    connection.release();
  }
}

// Run tests
testApartmentUserRelationship().catch(console.error);
