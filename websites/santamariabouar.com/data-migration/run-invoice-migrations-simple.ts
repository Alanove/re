/**
 * Run Invoice-Related Migrations (Simplified)
 * This script runs only the invoice-related migrations in the correct order
 */

import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

const migrationsDir = path.join(__dirname);

async function runInvoiceMigrations() {
  console.log('🚀 Starting invoice migration process...\n');
  
  try {
    // Test connection
    await db.testConnection();
    
    // Step 1: Create apartment_invoices table
    console.log('\n🔄 Step 1: Creating apartment_invoices table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS apartment_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        category_id INT NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        description TEXT,
        due_date DATE,
        invoice_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'unpaid',
        amount_paid DECIMAL(18,2) DEFAULT 0,
        invoice_type VARCHAR(50) DEFAULT 'other',
        payment_id INT NULL,
        year INT NULL,
        notes TEXT,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES transaction_categories(id),
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_apartment (apartment_id),
        INDEX idx_category (category_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_invoice_type (invoice_type),
        INDEX idx_payment_id (payment_id),
        INDEX idx_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    try {
      await db.query(createTableSQL);
      console.log('✅ apartment_invoices table created');
    } catch (error: any) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✅ apartment_invoices table already exists');
      } else {
        throw error;
      }
    }
    
    // Step 2: Add invoice_id column to transactions
    console.log('\n🔄 Step 2: Adding invoice_id column to transactions...');
    
    // Check if column exists
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'transactions' 
      AND COLUMN_NAME = 'invoice_id'
    `) as [any[], any];
    
    if (columns.length === 0) {
      // Add column
      await db.query(`
        ALTER TABLE transactions 
        ADD COLUMN invoice_id INT NULL AFTER apartment_id
      `);
      console.log('✅ invoice_id column added');
      
      // Add foreign key
      try {
        await db.query(`
          ALTER TABLE transactions 
          ADD FOREIGN KEY (invoice_id) REFERENCES apartment_invoices(id) ON DELETE SET NULL
        `);
        console.log('✅ Foreign key constraint added');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log('⚠️  Foreign key may already exist');
        } else {
          throw error;
        }
      }
      
      // Add index
      try {
        await db.query(`
          CREATE INDEX idx_invoice_id ON transactions(invoice_id)
        `);
        console.log('✅ Index added');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('⚠️  Index may already exist');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ invoice_id column already exists');
    }
    
    // Step 3: Migrate apartment_payments to invoices
    console.log('\n🔄 Step 3: Migrating apartment_payments to invoices...');
    
    // Get Common Expenses category ID
    const [categoryRows] = await db.query(`
      SELECT id FROM transaction_categories WHERE LOWER(name) = 'common expenses' LIMIT 1
    `) as [any[], any];
    
    let categoryId = 1; // fallback
    if (categoryRows.length > 0) {
      categoryId = categoryRows[0].id;
      console.log(`   Using Common Expenses category ID: ${categoryId}`);
    } else {
      console.log(`   ⚠️  Common Expenses category not found, using fallback ID: ${categoryId}`);
    }
    
    // Migrate data
    const migrateSQL = `
      INSERT INTO apartment_invoices (
        apartment_id,
        category_id,
        amount,
        description,
        due_date,
        invoice_date,
        status,
        amount_paid,
        invoice_type,
        payment_id,
        year,
        notes,
        created_by,
        created_at,
        updated_at
      )
      SELECT 
        ap.apartment_id,
        ? as category_id,
        ap.amount_due as amount,
        CONCAT(
          'Common Expenses ', 
          COALESCE(p.year, ''), 
          CASE 
            WHEN a.floor IS NOT NULL AND a.apartment_number IS NOT NULL 
            THEN CONCAT(' - Block ', a.floor, ' ', a.apartment_number)
            ELSE ''
          END,
          ' (Migrated)'
        ) as description,
        CASE 
          WHEN p.year IS NOT NULL THEN CONCAT(p.year, '-12-31')
          ELSE NULL
        END as due_date,
        COALESCE(
          ap.payment_date, 
          DATE(ap.created_at), 
          CASE 
            WHEN p.year IS NOT NULL THEN CONCAT(p.year, '-01-01')
            ELSE DATE(NOW())
          END
        ) as invoice_date,
        ap.status,
        ap.amount_paid,
        'common_expense' as invoice_type,
        ap.payment_id,
        p.year,
        ap.notes,
        NULL as created_by,
        ap.created_at,
        ap.updated_at
      FROM apartment_payments ap
      LEFT JOIN payments p ON ap.payment_id = p.id
      LEFT JOIN apartments a ON ap.apartment_id = a.id
      WHERE NOT EXISTS (
        SELECT 1 FROM apartment_invoices ai
        WHERE ai.apartment_id = ap.apartment_id
        AND ai.year = p.year
        AND ai.invoice_type = 'common_expense'
        AND ai.payment_id = ap.payment_id
      )
      AND ap.amount_due > 0
    `;
    
    const [result] = await db.query(migrateSQL, [categoryId]) as [any, any];
    const migratedCount = (result as any).affectedRows || 0;
    console.log(`✅ Migrated ${migratedCount} apartment_payments to invoices`);
    
    // Verify migration
    console.log('\n📊 Verifying migration...');
    const [invoiceCount] = await db.query('SELECT COUNT(*) as count FROM apartment_invoices') as [any[], any];
    const [paymentCount] = await db.query('SELECT COUNT(*) as count FROM apartment_payments') as [any[], any];
    const [invoiceByType] = await db.query("SELECT COUNT(*) as count FROM apartment_invoices WHERE invoice_type = 'common_expense'") as [any[], any];
    
    console.log(`   ✅ Total invoices: ${invoiceCount[0].count}`);
    console.log(`   ✅ Common expense invoices: ${invoiceByType[0].count}`);
    console.log(`   ✅ Apartment payments (preserved): ${paymentCount[0].count}`);
    
    console.log('\n🎉 Invoice migrations completed successfully!');
    console.log('   Note: apartment_payments table has been preserved for backward compatibility.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

runInvoiceMigrations().catch(console.error);

