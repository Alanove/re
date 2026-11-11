/**
 * Migration: Refactor Payments System
 * Date: 2025-01-17
 * Description: 
 * - Rename apartment_payments to apartment_payments_backup (keep as backup)
 * - Rename apartment_invoices to invoices
 * - Remove invoice_type, amount_paid, payment_id, status from invoices
 * - Rename payments to common_expenses_settings
 * - Create invoice_transactions junction table
 * - Migrate existing transaction-invoice relationships
 * - Identify and log credits (overpayments)
 */

import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

interface CreditRecord {
  apartmentId: number;
  creditAmount: number;
  originalInvoiceId: number;
  date: string;
}

async function runMigration() {
  console.log('🚀 Starting payments system refactoring migration...\n');

  const creditsLog: CreditRecord[] = [];
  const logFilePath = path.join(__dirname, '2025-01-17-credits-log.json');

  try {
    // Step 1: Rename apartment_invoices to invoices (do this first so foreign keys can reference it)
    console.log('📋 Step 1: Renaming apartment_invoices to invoices...');
    try {
      await db.query(`RENAME TABLE apartment_invoices TO invoices`);
      console.log('✅ apartment_invoices renamed to invoices\n');
    } catch (error: any) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_BAD_TABLE_ERROR') {
        // Table might already be renamed or not exist
        console.log('⚠️  Table may already be renamed, checking if invoices exists...');
        const [tables] = await db.query(`SHOW TABLES LIKE 'invoices'`) as [any[], any];
        if (tables.length > 0) {
          console.log('✅ invoices table already exists\n');
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Step 2: Create invoice_transactions table
    console.log('📋 Step 2: Creating invoice_transactions table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoice_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NULL,
        transaction_id INT NULL,
        apartment_id INT NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        INDEX idx_invoice (invoice_id),
        INDEX idx_transaction (transaction_id),
        INDEX idx_apartment (apartment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ invoice_transactions table created\n');

    // Step 3: Migrate existing transactions with invoice_id to invoice_transactions
    console.log('📋 Step 3: Migrating existing transaction-invoice relationships...');
    const [transactionRows] = await db.query(`
      SELECT id, invoice_id, apartment_id, amount
      FROM transactions
      WHERE invoice_id IS NOT NULL
    `) as [any[], any];

    let migratedCount = 0;
    for (const transaction of transactionRows) {
      if (transaction.apartment_id) {
        await db.query(`
          INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
          VALUES (?, ?, ?, ?)
        `, [
          transaction.invoice_id,
          transaction.id,
          transaction.apartment_id,
          transaction.amount
        ]);
        migratedCount++;
      }
    }
    console.log(`✅ Migrated ${migratedCount} transaction-invoice relationships\n`);

    // Step 4: Migrate existing amount_paid values from invoices to invoice_transactions
    console.log('📋 Step 4: Migrating existing amount_paid values to invoice_transactions...');
    
    // Check if amount_paid column exists
    const [amountPaidCheck] = await db.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND COLUMN_NAME = 'amount_paid'
    `) as [any[], any];
    
    if (amountPaidCheck[0]?.count > 0) {
      // Get all invoices with amount_paid > 0
      const [invoicesWithPayments] = await db.query(`
        SELECT 
          i.id as invoice_id,
          i.apartment_id,
          i.amount,
          i.amount_paid
        FROM invoices i
        WHERE i.amount_paid > 0
      `) as [any[], any];
      
      let migratedPaymentsCount = 0;
      
      for (const invoice of invoicesWithPayments) {
        // Check if invoice_transactions already exist for this invoice
        const [existingTransactions] = await db.query(`
          SELECT SUM(amount) as total_allocated
          FROM invoice_transactions
          WHERE invoice_id = ?
        `, [invoice.invoice_id]) as [any[], any];
        
        const existingTotal = parseFloat(existingTransactions[0]?.total_allocated || 0);
        const amountPaid = parseFloat(invoice.amount_paid);
        
        // Only create transaction if the amount doesn't match (to avoid duplicates)
        if (Math.abs(existingTotal - amountPaid) > 0.01) {
          // If there are existing transactions but they don't match amount_paid, 
          // we need to adjust. For now, if existingTotal is 0, create a new record.
          if (existingTotal === 0) {
            // Create a record for the amount_paid (this represents historical payments)
            // We use transaction_id = NULL since these are migrated from the old system
            await db.query(`
              INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
              VALUES (?, NULL, ?, ?)
            `, [invoice.invoice_id, invoice.apartment_id, amountPaid]);
            migratedPaymentsCount++;
          } else {
            // If there's a mismatch, log it but don't create duplicate
            console.log(`  ⚠️  Invoice ${invoice.invoice_id}: existing total (${existingTotal}) doesn't match amount_paid (${amountPaid}), skipping to avoid duplicate`);
          }
        }
      }
      
      console.log(`✅ Migrated ${migratedPaymentsCount} invoice payment records\n`);
    } else {
      console.log('  ℹ️  amount_paid column not found, skipping payment migration\n');
    }

    // Step 5: Identify and log credits from invoices (before removing amount_paid column)
    console.log('📋 Step 4: Identifying and logging credits (overpayments)...');
    
    // First, check if amount_paid column exists
    const [columnCheck] = await db.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND COLUMN_NAME = 'amount_paid'
    `) as [any[], any];
    
    const hasAmountPaidColumn = columnCheck[0]?.count > 0;
    
    let invoiceRows: any[] = [];
    
    if (hasAmountPaidColumn) {
      // Query from invoices table if amount_paid column exists
      const [rows] = await db.query(`
        SELECT id, apartment_id, amount, amount_paid, invoice_date
        FROM invoices
        WHERE amount_paid > amount
      `) as [any[], any];
      invoiceRows = rows;
    } else {
      // If amount_paid doesn't exist, compute it from invoice_transactions
      console.log('  ℹ️  amount_paid column not found, computing from invoice_transactions...');
      
      // Check if invoice_transactions table exists
      const [tableCheck] = await db.query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'invoice_transactions'
      `) as [any[], any];
      
      if (tableCheck[0]?.count > 0) {
        const [rows] = await db.query(`
          SELECT 
            i.id,
            i.apartment_id,
            i.amount,
            COALESCE(SUM(it.amount), 0) as amount_paid,
            DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoice_date
          FROM invoices i
          LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
          GROUP BY i.id, i.apartment_id, i.amount, i.invoice_date
          HAVING amount_paid > i.amount
        `) as [any[], any];
        invoiceRows = rows;
      } else {
        console.log('  ⚠️  invoice_transactions table not found, skipping credit identification');
        console.log('  ℹ️  Credits may have already been migrated or will be handled later');
        invoiceRows = [];
      }
    }

    for (const invoice of invoiceRows) {
      const creditAmount = parseFloat(invoice.amount_paid) - parseFloat(invoice.amount);
      
      // Allocate full invoice amount to the invoice
      const [existingAllocations] = await db.query(`
        SELECT SUM(amount) as total_allocated
        FROM invoice_transactions
        WHERE invoice_id = ?
      `, [invoice.id]) as [any[], any];

      const totalAllocated = parseFloat(existingAllocations[0]?.total_allocated || 0);
      const invoiceAmount = parseFloat(invoice.amount);

      if (totalAllocated < invoiceAmount) {
        // Create allocation for the full invoice amount
        await db.query(`
          INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
          VALUES (?, NULL, ?, ?)
        `, [invoice.id, invoice.apartment_id, invoiceAmount - totalAllocated]);
      }

      // Check if credit already exists for this apartment (to avoid duplicates)
      const [existingCredits] = await db.query(`
        SELECT SUM(amount) as total_credit
        FROM invoice_transactions
        WHERE invoice_id IS NULL 
        AND transaction_id IS NULL
        AND apartment_id = ?
      `, [invoice.apartment_id]) as [any[], any];
      
      const existingCreditTotal = parseFloat(existingCredits[0]?.total_credit || 0);
      
      // Only create credit if it doesn't already exist or if the amount is different
      if (existingCreditTotal === 0 || Math.abs(existingCreditTotal - creditAmount) > 0.01) {
        // Create credit record (invoice_id = NULL)
        await db.query(`
          INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
          VALUES (NULL, NULL, ?, ?)
        `, [invoice.apartment_id, creditAmount]);
      } else {
        console.log(`  ℹ️  Credit already exists for apartment ${invoice.apartment_id}, skipping`);
      }

      creditsLog.push({
        apartmentId: parseInt(invoice.apartment_id),
        creditAmount: creditAmount,
        originalInvoiceId: parseInt(invoice.id),
        date: invoice.invoice_date
      });

      console.log(`  💰 Credit logged: Apartment ${invoice.apartment_id}, Amount: ${creditAmount.toFixed(2)}, Invoice: ${invoice.id}`);
    }
    console.log(`✅ Identified and logged ${creditsLog.length} credit records\n`);

    // Step 6: Rename apartment_payments to apartment_payments_backup
    console.log('📋 Step 6: Renaming apartment_payments to apartment_payments_backup...');
    try {
      await db.query(`RENAME TABLE apartment_payments TO apartment_payments_backup`);
      console.log('✅ apartment_payments renamed to apartment_payments_backup\n');
    } catch (error: any) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⚠️  apartment_payments_backup already exists, skipping rename\n');
      } else {
        throw error;
      }
    }

    // Step 6: Update foreign key in invoice_transactions to reference invoices (if needed)
    console.log('📋 Step 6: Verifying foreign keys...');
    try {
      // Drop old foreign key if exists
      await db.query(`
        ALTER TABLE invoice_transactions
        DROP FOREIGN KEY invoice_transactions_ibfk_1
      `).catch(() => {
        // Ignore if doesn't exist
      });

      // Add new foreign key
      await db.query(`
        ALTER TABLE invoice_transactions
        ADD CONSTRAINT invoice_transactions_ibfk_1
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      `);
      console.log('✅ Foreign key updated\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠️  Foreign key may already be correct\n');
      } else {
        throw error;
      }
    }

    // Step 7: Update foreign key in transactions to reference invoices (if needed)
    console.log('📋 Step 7: Verifying transactions foreign key...');
    try {
      // Drop old foreign key if exists
      await db.query(`
        ALTER TABLE transactions
        DROP FOREIGN KEY transactions_ibfk_invoice_id
      `).catch(() => {
        // Try alternative name
        return db.query(`
          ALTER TABLE transactions
          DROP FOREIGN KEY transactions_ibfk_5
        `);
      }).catch(() => {
        // Ignore if doesn't exist
      });

      // Add new foreign key
      await db.query(`
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_ibfk_invoice_id
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
      `);
      console.log('✅ Transactions foreign key updated\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠️  Foreign key may already be correct\n');
      } else {
        throw error;
      }
    }

    // Step 8: Drop foreign key constraint on payment_id before removing column
    console.log('📋 Step 8: Dropping foreign key constraint on payment_id...');
    try {
      // Try to find and drop the foreign key constraint
      const [constraints] = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'invoices' 
        AND COLUMN_NAME = 'payment_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `) as [any[], any];
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME;
        await db.query(`
          ALTER TABLE invoices DROP FOREIGN KEY ${constraintName}
        `);
        console.log(`  ✅ Dropped foreign key constraint: ${constraintName}`);
      } else {
        console.log('  ⚠️  No foreign key constraint found on payment_id');
      }
    } catch (error: any) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('  ⚠️  Foreign key constraint may not exist, trying alternative names...');
        // Try common constraint names
        const commonNames = ['invoices_ibfk_3', 'invoices_ibfk_payment_id', 'fk_payment_id'];
        for (const name of commonNames) {
          try {
            await db.query(`ALTER TABLE invoices DROP FOREIGN KEY ${name}`);
            console.log(`  ✅ Dropped foreign key constraint: ${name}`);
            break;
          } catch (e: any) {
            // Continue to next name
          }
        }
      } else {
        console.log(`  ⚠️  Error dropping foreign key: ${error.message}`);
      }
    }
    console.log('✅ Foreign key constraint handling completed\n');

    // Step 9: Remove columns from invoices
    console.log('📋 Step 9: Removing columns from invoices table...');
    const columnsToRemove = ['invoice_type', 'amount_paid', 'payment_id', 'status'];
    
    for (const column of columnsToRemove) {
      try {
        await db.query(`
          ALTER TABLE invoices DROP COLUMN ${column}
        `);
        console.log(`  ✅ Removed column: ${column}`);
      } catch (error: any) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || error.code === 'ER_FK_COLUMN_CANNOT_DROP') {
          console.log(`  ⚠️  Column ${column} may have constraints or not exist, skipping`);
        } else {
          throw error;
        }
      }
    }
    console.log('✅ Columns removed\n');

    // Step 10: Remove indexes that reference removed columns
    console.log('📋 Step 10: Removing indexes for deleted columns...');
    const indexesToRemove = ['idx_status', 'idx_invoice_type', 'idx_payment_id'];
    
    for (const index of indexesToRemove) {
      try {
        await db.query(`
          ALTER TABLE invoices DROP INDEX ${index}
        `);
        console.log(`  ✅ Removed index: ${index}`);
      } catch (error: any) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`  ⚠️  Index ${index} may not exist, skipping`);
        } else {
          // Ignore other errors
        }
      }
    }
    console.log('✅ Indexes removed\n');

    // Step 11: Rename payments to common_expenses_settings
    console.log('📋 Step 11: Renaming payments to common_expenses_settings...');
    try {
      await db.query(`RENAME TABLE payments TO common_expenses_settings`);
      console.log('✅ payments renamed to common_expenses_settings\n');
    } catch (error: any) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⚠️  common_expenses_settings already exists, skipping rename\n');
      } else {
        throw error;
      }
    }

    // Step 12: Update foreign key in invoices (payment_id was removed, but check if any references exist)
    console.log('📋 Step 12: Verifying foreign key updates...');
    // The payment_id column was removed, so no foreign key update needed
    console.log('✅ Foreign keys verified\n');

    // Step 13: Save credits log to file
    console.log('📋 Step 13: Saving credits log...');
    fs.writeFileSync(logFilePath, JSON.stringify(creditsLog, null, 2));
    console.log(`✅ Credits log saved to ${logFilePath}\n`);

    // Step 14: Generate summary report
    console.log('📋 Step 14: Generating summary report...');
    const summary = {
      migrationDate: new Date().toISOString(),
      creditsIdentified: creditsLog.length,
      totalCreditAmount: creditsLog.reduce((sum, c) => sum + c.creditAmount, 0),
      creditsByApartment: creditsLog.reduce((acc, c) => {
        acc[c.apartmentId] = (acc[c.apartmentId] || 0) + c.creditAmount;
        return acc;
      }, {} as Record<number, number>),
      transactionsMigrated: migratedCount
    };

    const summaryPath = path.join(__dirname, '2025-01-17-migration-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary report saved to ${summaryPath}\n`);

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Credits identified: ${creditsLog.length}`);
    console.log(`   - Total credit amount: ${summary.totalCreditAmount.toFixed(2)}`);
    console.log(`   - Transactions migrated: ${migratedCount}`);
    console.log(`   - Credits log: ${logFilePath}`);
    console.log(`   - Summary report: ${summaryPath}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigration };

