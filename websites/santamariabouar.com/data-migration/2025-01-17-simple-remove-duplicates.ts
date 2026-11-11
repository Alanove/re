/**
 * Simple Fix: Remove Duplicate Invoice Transactions
 * Date: 2025-01-17
 * Description: 
 * Simple script to remove duplicate invoice_transactions for the same invoice
 * Keeps the first record, deletes the rest
 */

import { db } from '../src/config/database';

async function removeDuplicates() {
  console.log('🔧 Starting simple duplicate removal...\n');

  try {
    // Find all invoices with multiple invoice_transactions
    console.log('📋 Finding invoices with duplicate invoice_transactions...\n');
    
    const [duplicates] = await db.query(`
      SELECT 
        invoice_id,
        COUNT(*) as count
      FROM invoice_transactions
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id
      HAVING count > 1
      ORDER BY invoice_id
    `) as [any[], any];

    console.log(`Found ${duplicates.length} invoices with duplicates\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found.');
      return;
    }

    let totalRemoved = 0;

    for (const dup of duplicates) {
      const invoiceId = dup.invoice_id;
      const count = parseInt(dup.count);
      
      console.log(`  Invoice ${invoiceId}: ${count} records`);
      
      // Get all records for this invoice, ordered by created_at
      const [records] = await db.query(`
        SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
        FROM invoice_transactions
        WHERE invoice_id = ?
        ORDER BY 
          CASE WHEN transaction_id IS NOT NULL THEN 0 ELSE 1 END,
          created_at ASC
      `, [invoiceId]) as [any[], any];

      // Keep the first record (prefer real transactions with transaction_id)
      const recordToKeep = records[0];
      const recordsToDelete = records.slice(1);

      console.log(`    Keeping record ID ${recordToKeep.id} (transaction_id: ${recordToKeep.transaction_id || 'NULL'}, amount: $${parseFloat(recordToKeep.amount).toFixed(2)})`);
      console.log(`    Deleting ${recordsToDelete.length} duplicate(s):`);

      for (const record of recordsToDelete) {
        console.log(`      - ID ${record.id} (transaction_id: ${record.transaction_id || 'NULL'}, amount: $${parseFloat(record.amount).toFixed(2)})`);
        
        await db.query(`
          DELETE FROM invoice_transactions
          WHERE id = ?
        `, [record.id]);
        
        totalRemoved++;
      }
      
      console.log(`    ✅ Removed ${recordsToDelete.length} duplicate(s)\n`);
    }

    console.log(`✅ Removed ${totalRemoved} duplicate records total\n`);

    // Verify
    console.log('📋 Verifying...\n');
    
    const [remainingDuplicates] = await db.query(`
      SELECT 
        invoice_id,
        COUNT(*) as count
      FROM invoice_transactions
      WHERE invoice_id IS NOT NULL
      GROUP BY invoice_id
      HAVING count > 1
    `) as [any[], any];

    if (remainingDuplicates.length > 0) {
      console.log(`⚠️  ${remainingDuplicates.length} invoices still have duplicates`);
    } else {
      console.log('✅ All duplicates removed!\n');
    }

    // Check totals
    const [incorrectTotals] = await db.query(`
      SELECT 
        i.id as invoice_id,
        i.amount as invoice_amount,
        COALESCE(SUM(it.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      GROUP BY i.id, i.amount
      HAVING total_paid > i.amount
    `) as [any[], any];

    if (incorrectTotals.length > 0) {
      console.log(`\n⚠️  Found ${incorrectTotals.length} invoices where total_paid > invoice_amount:`);
      incorrectTotals.forEach((inv: any) => {
        const invoiceAmount = parseFloat(inv.invoice_amount || 0);
        const totalPaid = parseFloat(inv.total_paid || 0);
        console.log(`  Invoice ${inv.invoice_id}: Amount $${invoiceAmount.toFixed(2)}, Paid $${totalPaid.toFixed(2)}`);
      });
      console.log('\n  These may need manual adjustment.\n');
    } else {
      console.log('✅ All invoices have correct payment totals.\n');
    }

    console.log('✅ Fix completed!\n');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  removeDuplicates()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { removeDuplicates };



