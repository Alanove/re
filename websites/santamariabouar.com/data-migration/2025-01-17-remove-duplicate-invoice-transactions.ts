/**
 * Fix Script: Remove Duplicate Invoice Transactions
 * Date: 2025-01-17
 * Description: 
 * This script finds and removes duplicate invoice_transactions records
 * that were created during migration, keeping only one record per invoice
 */

import { db } from '../src/config/database';

interface DuplicateGroup {
  invoiceId: number;
  apartmentId: number;
  count: number;
  totalAmount: number;
  correctAmount: number;
  records: any[];
}

async function removeDuplicateInvoiceTransactions() {
  console.log('🔧 Starting duplicate invoice_transactions removal...\n');

  try {
    // Step 1: Find all duplicate invoice_transactions
    console.log('📋 Step 1: Finding duplicate invoice_transactions...\n');
    
    const [duplicates] = await db.query(`
      SELECT 
        invoice_id,
        apartment_id,
        COUNT(*) as duplicate_count,
        SUM(amount) as total_amount,
        GROUP_CONCAT(id ORDER BY created_at) as record_ids
      FROM invoice_transactions
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id, apartment_id
      HAVING duplicate_count > 1
      ORDER BY invoice_id
    `) as [any[], any];

    console.log(`Found ${duplicates.length} invoices with duplicate invoice_transactions\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found. All invoice_transactions are unique.');
      return;
    }

    // Step 2: Analyze each duplicate group
    console.log('📋 Step 2: Analyzing duplicates...\n');
    
    const duplicateGroups: DuplicateGroup[] = [];
    
    for (const dup of duplicates) {
      const invoiceId = dup.invoice_id;
      const apartmentId = dup.apartment_id;
      const duplicateCount = parseInt(dup.duplicate_count);
      const totalAmount = parseFloat(dup.total_amount);
      
      // Get the invoice amount to determine correct amount
      const [invoiceRows] = await db.query(`
        SELECT amount
        FROM invoices
        WHERE id = ?
      `, [invoiceId]) as [any[], any];
      
      const invoiceAmount = invoiceRows.length > 0 ? parseFloat(invoiceRows[0].amount || 0) : 0;
      
      // Get all records for this invoice
      const [records] = await db.query(`
        SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
        FROM invoice_transactions
        WHERE invoice_id = ?
        ORDER BY created_at
      `, [invoiceId]) as [any[], any];
      
      // Determine correct amount
      // If there are real transactions (with transaction_id), use those
      const realTransactions = records.filter((r: any) => r.transaction_id !== null);
      const migratedTransactions = records.filter((r: any) => r.transaction_id === null);
      
      let correctAmount = 0;
      let recordsToKeep: any[] = [];
      
      if (realTransactions.length > 0) {
        // Has real transactions, keep those
        correctAmount = realTransactions.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);
        recordsToKeep = realTransactions;
        console.log(`  Invoice ${invoiceId}: Has ${realTransactions.length} real transaction(s), total: $${correctAmount.toFixed(2)}`);
      } else if (migratedTransactions.length > 0) {
        // Only migrated transactions, keep the first one with correct amount
        // The correct amount should be min(total, invoice_amount)
        correctAmount = Math.min(totalAmount, invoiceAmount);
        // Keep the first record, but we'll update its amount
        recordsToKeep = [migratedTransactions[0]];
        console.log(`  Invoice ${invoiceId}: Only migrated transactions, will keep first and set amount to $${correctAmount.toFixed(2)}`);
      }
      
      duplicateGroups.push({
        invoiceId: invoiceId,
        apartmentId: apartmentId,
        count: duplicateCount,
        totalAmount: totalAmount,
        correctAmount: correctAmount,
        records: records
      });
      
      console.log(`    Duplicate count: ${duplicateCount}`);
      console.log(`    Total amount: $${totalAmount.toFixed(2)}`);
      console.log(`    Invoice amount: $${invoiceAmount.toFixed(2)}`);
      console.log(`    Correct amount: $${correctAmount.toFixed(2)}`);
      console.log(`    Records to keep: ${recordsToKeep.length}\n`);
    }

    // Step 3: Fix duplicates
    console.log('📋 Step 3: Removing duplicates...\n');
    
    let fixedCount = 0;
    let totalRemoved = 0;
    
    for (const group of duplicateGroups) {
      console.log(`  Fixing Invoice ${group.invoiceId}:`);
      
      const realTransactions = group.records.filter((r: any) => r.transaction_id !== null);
      const migratedTransactions = group.records.filter((r: any) => r.transaction_id === null);
      
      if (realTransactions.length > 0) {
        // Has real transactions, keep those and remove all migrated duplicates
        const realTransactionIds = realTransactions.map((r: any) => r.id);
        const migratedTransactionIds = migratedTransactions.map((r: any) => r.id);
        
        if (migratedTransactionIds.length > 0) {
          // Use parameterized query to avoid SQL injection
          const placeholders = migratedTransactionIds.map(() => '?').join(',');
          await db.query(`
            DELETE FROM invoice_transactions
            WHERE id IN (${placeholders})
          `, migratedTransactionIds);
          console.log(`    ✅ Kept ${realTransactions.length} real transaction(s), removed ${migratedTransactionIds.length} duplicate(s)`);
          totalRemoved += migratedTransactionIds.length;
        } else {
          console.log(`    ℹ️  Only real transactions exist, no duplicates to remove`);
        }
      } else {
        // Only migrated transactions, keep the first one and remove the rest
        const recordsToKeep = [migratedTransactions[0]];
        const recordsToDelete = migratedTransactions.slice(1);
        
        // Update the kept record to have the correct amount
        await db.query(`
          UPDATE invoice_transactions
          SET amount = ?
          WHERE id = ?
        `, [group.correctAmount, recordsToKeep[0].id]);
        
        // Delete the duplicates
        if (recordsToDelete.length > 0) {
          const idsToDelete = recordsToDelete.map((r: any) => r.id);
          const placeholders = idsToDelete.map(() => '?').join(',');
          await db.query(`
            DELETE FROM invoice_transactions
            WHERE id IN (${placeholders})
          `, idsToDelete);
          console.log(`    ✅ Kept 1 record (updated amount to $${group.correctAmount.toFixed(2)}), removed ${recordsToDelete.length} duplicate(s)`);
          totalRemoved += recordsToDelete.length;
        }
      }
      
      fixedCount++;
      console.log('');
    }

    console.log(`✅ Fixed ${fixedCount} invoices, removed ${totalRemoved} duplicate records\n`);

    // Step 4: Verify fixes
    console.log('📋 Step 4: Verifying fixes...\n');
    
    const [remainingDuplicates] = await db.query(`
      SELECT 
        invoice_id,
        COUNT(*) as duplicate_count
      FROM invoice_transactions
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id, apartment_id
      HAVING duplicate_count > 1
    `) as [any[], any];

    if (remainingDuplicates.length > 0) {
      console.log(`⚠️  ${remainingDuplicates.length} invoices still have duplicates:`);
      remainingDuplicates.forEach((dup: any) => {
        console.log(`  Invoice ${dup.invoice_id}: ${dup.duplicate_count} records`);
      });
    } else {
      console.log('✅ All duplicates removed. Verification passed.\n');
    }

    // Step 5: Check for invoices with incorrect totals
    console.log('📋 Step 5: Checking for invoices with incorrect payment totals...\n');
    
    const [incorrectTotals] = await db.query(`
      SELECT 
        i.id as invoice_id,
        i.amount as invoice_amount,
        COALESCE(SUM(it.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      GROUP BY i.id, i.amount
      HAVING total_paid > invoice_amount
    `) as [any[], any];

    if (incorrectTotals.length > 0) {
      console.log(`⚠️  Found ${incorrectTotals.length} invoices where total_paid > invoice_amount:`);
      incorrectTotals.forEach((inv: any) => {
        const invoiceAmount = parseFloat(inv.invoice_amount || 0);
        const totalPaid = parseFloat(inv.total_paid || 0);
        console.log(`  Invoice ${inv.invoice_id}: Amount $${invoiceAmount.toFixed(2)}, Paid $${totalPaid.toFixed(2)}`);
      });
      console.log('\n  These may need manual review.\n');
    } else {
      console.log('✅ All invoices have correct payment totals.\n');
    }

    console.log('✅ Fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  removeDuplicateInvoiceTransactions()
    .then(() => {
      console.log('Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fix failed:', error);
      process.exit(1);
    });
}

export { removeDuplicateInvoiceTransactions };

