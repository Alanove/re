/**
 * Fix Script: Correct invoice_transactions amounts
 * Date: 2025-01-17
 * Description: 
 * This script fixes incorrect amount_paid values in invoices by:
 * 1. Checking invoices where amount_paid doesn't match invoice_transactions totals
 * 2. Removing duplicate or incorrect invoice_transactions
 * 3. Recreating correct invoice_transactions from the backup data
 */

import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

interface InvoiceIssue {
  invoiceId: number;
  apartmentId: number;
  invoiceAmount: number;
  currentPaid: number;
  expectedPaid: number;
  difference: number;
}

async function fixInvoiceAmounts() {
  console.log('🔧 Starting invoice amounts fix...\n');

  try {
    // Step 1: Check if apartment_payments_backup exists
    const [backupCheck] = await db.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'apartment_payments_backup'
    `) as [any[], any];

    if (backupCheck[0]?.count === 0) {
      console.log('❌ apartment_payments_backup table not found. Cannot fix without backup data.');
      return;
    }

    // Step 2: Find invoices with incorrect amounts
    console.log('📋 Step 1: Identifying invoices with incorrect payment amounts...\n');
    
    const [issues] = await db.query(`
      SELECT 
        i.id as invoice_id,
        i.apartment_id,
        i.amount as invoice_amount,
        COALESCE(SUM(it.amount), 0) as current_paid,
        i.year
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      GROUP BY i.id, i.apartment_id, i.amount, i.year
      HAVING current_paid > invoice_amount
    `) as [any[], any];

    console.log(`Found ${issues.length} invoices with potential issues\n`);

    if (issues.length === 0) {
      console.log('✅ No issues found. All invoices have correct amounts.');
      return;
    }

    // Step 3: Analyze the issues and determine correct amounts
    console.log('📋 Step 2: Analyzing invoice issues...\n');
    
    const invoiceIssues: InvoiceIssue[] = [];
    
    for (const issue of issues) {
      const invoiceId = issue.invoice_id;
      const apartmentId = issue.apartment_id;
      const invoiceAmount = parseFloat(issue.invoice_amount);
      const currentPaid = parseFloat(issue.current_paid);
      
      console.log(`  Analyzing Invoice ${invoiceId}:`);
      console.log(`    Apartment: ${apartmentId}, Year: ${issue.year || 'N/A'}`);
      console.log(`    Invoice Amount: $${invoiceAmount.toFixed(2)}`);
      console.log(`    Current Paid (from invoice_transactions): $${currentPaid.toFixed(2)}`);
      
      // Get all invoice_transactions for this invoice to see what's wrong
      const [transactions] = await db.query(`
        SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
        FROM invoice_transactions
        WHERE invoice_id = ?
        ORDER BY created_at
      `, [invoiceId]) as [any[], any];
      
      console.log(`    Found ${transactions.length} invoice_transactions:`);
      transactions.forEach((t: any) => {
        console.log(`      - ID ${t.id}: $${parseFloat(t.amount).toFixed(2)} (transaction_id: ${t.transaction_id || 'NULL'})`);
      });
      
      // Try to find the original payment record from backup
      let expectedPaid = invoiceAmount; // Default to invoice amount (fully paid)
      
      if (issue.year) {
        const [backupPayments] = await db.query(`
          SELECT 
            ap.amount_paid,
            ap.amount_due
          FROM apartment_payments_backup ap
          LEFT JOIN common_expenses_settings p ON ap.payment_id = p.id
          WHERE ap.apartment_id = ?
          AND p.year = ?
          LIMIT 1
        `, [apartmentId, issue.year]) as [any[], any];

        if (backupPayments.length > 0) {
          expectedPaid = parseFloat(backupPayments[0].amount_paid || 0);
          console.log(`    Found in backup: Expected paid = $${expectedPaid.toFixed(2)}`);
        } else {
          console.log(`    Not found in backup (might be utility invoice or other type)`);
          // For non-common-expense invoices, check if there are actual transactions
          // If there are transactions linked, use the sum of those
          // Otherwise, if current_paid > invoice_amount, it's likely a duplicate issue
          if (transactions.some((t: any) => t.transaction_id !== null)) {
            // Has real transactions, sum those
            const transactionTotal = transactions
              .filter((t: any) => t.transaction_id !== null)
              .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
            expectedPaid = transactionTotal;
            console.log(`    Using transaction total: $${expectedPaid.toFixed(2)}`);
          } else {
            // No real transactions, likely should be 0 or invoice amount
            // If current_paid > invoice_amount, it's definitely wrong
            expectedPaid = Math.min(currentPaid, invoiceAmount);
            console.log(`    No transactions found, setting to invoice amount: $${expectedPaid.toFixed(2)}`);
          }
        }
      } else {
        // No year, check if there are actual transactions
        const hasRealTransactions = transactions.some((t: any) => t.transaction_id !== null);
        if (hasRealTransactions) {
          const transactionTotal = transactions
            .filter((t: any) => t.transaction_id !== null)
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
          expectedPaid = transactionTotal;
          console.log(`    Using transaction total (no year): $${expectedPaid.toFixed(2)}`);
        } else {
          // Likely a duplicate or incorrect migration
          expectedPaid = Math.min(currentPaid, invoiceAmount);
          console.log(`    No year and no transactions, capping at invoice amount: $${expectedPaid.toFixed(2)}`);
        }
      }
      
      const difference = currentPaid - expectedPaid;
      
      if (Math.abs(difference) > 0.01) {
        invoiceIssues.push({
          invoiceId: invoiceId,
          apartmentId: apartmentId,
          invoiceAmount: invoiceAmount,
          currentPaid: currentPaid,
          expectedPaid: expectedPaid,
          difference: difference
        });
        console.log(`    ✅ Will fix: Remove $${difference.toFixed(2)} excess\n`);
      } else {
        console.log(`    ℹ️  Amounts match, no fix needed\n`);
      }
    }

    console.log(`\nFound ${invoiceIssues.length} invoices that need correction\n`);

    if (invoiceIssues.length === 0) {
      console.log('✅ No corrections needed.');
      return;
    }

    // Step 4: Fix the invoices
    console.log('📋 Step 3: Fixing invoice_transactions...\n');
    
    let fixedCount = 0;
    
    for (const issue of invoiceIssues) {
      console.log(`  Fixing Invoice ${issue.invoiceId}:`);
      console.log(`    Current paid: $${issue.currentPaid.toFixed(2)}`);
      console.log(`    Expected paid: $${issue.expectedPaid.toFixed(2)}`);
      console.log(`    Difference to remove: $${issue.difference.toFixed(2)}`);

      // Get all invoice_transactions for this invoice
      const [transactions] = await db.query(`
        SELECT id, invoice_id, transaction_id, apartment_id, amount, created_at
        FROM invoice_transactions
        WHERE invoice_id = ?
        ORDER BY created_at
      `, [issue.invoiceId]) as [any[], any];

      // Strategy: Keep real transactions (with transaction_id), remove excess
      const realTransactions = transactions.filter((t: any) => t.transaction_id !== null);
      const migratedTransactions = transactions.filter((t: any) => t.transaction_id === null);
      
      const realTransactionTotal = realTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      if (realTransactionTotal > 0) {
        // Has real transactions, keep those and adjust migrated ones
        console.log(`    Keeping ${realTransactions.length} real transactions (total: $${realTransactionTotal.toFixed(2)})`);
        
        // Delete all migrated transactions (transaction_id = NULL)
        if (migratedTransactions.length > 0) {
          await db.query(`
            DELETE FROM invoice_transactions
            WHERE invoice_id = ? AND transaction_id IS NULL
          `, [issue.invoiceId]);
          console.log(`    Deleted ${migratedTransactions.length} migrated transactions`);
        }
        
        // If real transactions don't match expected, we might need to adjust
        // But for now, we'll keep real transactions as they are
        if (Math.abs(realTransactionTotal - issue.expectedPaid) > 0.01) {
          console.log(`    ⚠️  Real transactions total ($${realTransactionTotal.toFixed(2)}) doesn't match expected ($${issue.expectedPaid.toFixed(2)})`);
          console.log(`    Keeping real transactions as they represent actual payments`);
        }
      } else {
        // No real transactions, delete all and recreate with correct amount
        console.log(`    No real transactions found, recreating with correct amount`);
        await db.query(`
          DELETE FROM invoice_transactions
          WHERE invoice_id = ?
        `, [issue.invoiceId]);

        // Recreate with correct amount
        if (issue.expectedPaid > 0) {
          await db.query(`
            INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
            VALUES (?, NULL, ?, ?)
          `, [issue.invoiceId, issue.apartmentId, issue.expectedPaid]);
          console.log(`    Created new transaction with amount: $${issue.expectedPaid.toFixed(2)}`);
        }
      }

      fixedCount++;
      console.log(`    ✅ Fixed\n`);
    }

    console.log(`✅ Fixed ${fixedCount} invoices\n`);

    // Step 5: Verify fixes
    console.log('📋 Step 4: Verifying fixes...\n');
    
    const [remainingIssues] = await db.query(`
      SELECT 
        i.id as invoice_id,
        i.amount as invoice_amount,
        COALESCE(SUM(it.amount), 0) as current_paid
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      GROUP BY i.id, i.amount
      HAVING current_paid > invoice_amount
    `) as [any[], any];

    if (remainingIssues.length > 0) {
      console.log(`⚠️  ${remainingIssues.length} invoices still have issues:`);
      remainingIssues.forEach((issue: any) => {
        console.log(`  Invoice ${issue.invoice_id}: Amount $${issue.invoice_amount.toFixed(2)}, Paid $${issue.current_paid.toFixed(2)}`);
      });
    } else {
      console.log('✅ All invoices verified. No remaining issues.\n');
    }

    console.log('✅ Fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  fixInvoiceAmounts()
    .then(() => {
      console.log('Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fix failed:', error);
      process.exit(1);
    });
}

export { fixInvoiceAmounts };

