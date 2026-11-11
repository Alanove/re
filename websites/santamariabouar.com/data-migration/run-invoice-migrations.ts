/**
 * Run Invoice-Related Migrations
 * This script runs only the invoice-related migrations in the correct order
 */

import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

const migrationsDir = path.join(__dirname);

async function runInvoiceMigrations() {
  console.log('🚀 Starting invoice migration process...\n');
  
  const migrations = [
    '2025-01-16-create-apartment-invoices-table.sql',
    '2025-01-16-add-invoice-id-to-transactions.sql',
    '2025-01-16-migrate-apartment-payments-to-invoices.sql'
  ];

  try {
    // Test connection
    await db.testConnection();
    
    for (const migrationFile of migrations) {
      const filePath = path.join(migrationsDir, migrationFile);
      console.log(`\n🔄 Running migration: ${migrationFile}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Migration file not found: ${filePath}`);
        continue;
      }
      
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // For prepared statement migrations, execute the whole SQL file
      // MySQL prepared statements need to be executed in a single connection
      try {
        console.log(`   Executing migration SQL...`);
        // Execute the entire SQL file as-is (prepared statements will work)
        const connection = await db.getConnection();
        try {
          // Split by semicolons but keep prepared statements together
          const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
          
          for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.startsWith('--')) {
              try {
                await connection.query(trimmed);
              } catch (error: any) {
                // Some statements might fail if they already exist (idempotent), that's okay
                if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME' || 
                    error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY' ||
                    error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                  console.log(`   ⚠️  Statement already executed (skipping): ${error.message.substring(0, 50)}...`);
                } else {
                  throw error;
                }
              }
            }
          }
        } finally {
          connection.release();
        }
      } catch (error: any) {
        // Some statements might fail if they already exist (idempotent), that's okay
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME' || 
            error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY' ||
            error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || error.code === 'ER_FK_CANNOT_OPEN_PARENT') {
          console.log(`   ⚠️  Migration may have already been executed (checking): ${error.message.substring(0, 50)}...`);
          // Check if the column already exists
          try {
            const [columns] = await db.query(`
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'transactions' 
              AND COLUMN_NAME = 'invoice_id'
            `) as [any[], any];
            if (columns.length > 0) {
              console.log(`   ✅ Column invoice_id already exists, skipping...`);
            } else {
              throw error;
            }
          } catch (checkError) {
            throw error;
          }
        } else {
          throw error;
        }
      }
      
      console.log(`✅ Migration ${migrationFile} completed`);
    }
    
    // Verify migration
    console.log('\n📊 Verifying migration...');
    const [invoiceCount] = await db.query('SELECT COUNT(*) as count FROM apartment_invoices') as [any[], any];
    const [paymentCount] = await db.query('SELECT COUNT(*) as count FROM apartment_payments') as [any[], any];
    
    console.log(`   ✅ Invoices created: ${invoiceCount[0].count}`);
    console.log(`   ✅ Apartment payments (preserved): ${paymentCount[0].count}`);
    
    console.log('\n🎉 Invoice migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

runInvoiceMigrations().catch(console.error);

