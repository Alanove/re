/**
 * Fix Script: Link Existing Transactions to Invoices
 * Date: 2025-01-17
 * Description: 
 * This script finds transactions that should be linked to invoices but aren't,
 * and creates the proper invoice_transactions records
 */

import { db } from '../src/config/database';

interface UnlinkedTransaction {
  transactionId: number;
  invoiceId: number | null;
  apartmentId: number | null;
  amount: number;
  date: string;
  description: string;
  categoryId: number;
}

async function linkTransactionsToInvoices() {
  console.log('🔧 Starting transaction-to-invoice linking...\n');

  try {
    // Step 1: Find transactions that should be linked to invoices
    console.log('📋 Step 1: Finding transactions that should be linked to invoices...\n');
    
    // Get all income transactions for apartments (these are usually invoice payments)
    const [transactions] = await db.query(`
      SELECT 
        t.id as transaction_id,
        t.invoice_id,
        t.apartment_id,
        t.amount,
        t.date,
        t.description,
        t.category_id,
        tc.name as category_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      WHERE t.apartment_id IS NOT NULL
      AND t.type = 'income'
      AND (t.invoice_id IS NULL OR t.invoice_id = 0)
      ORDER BY t.date DESC, t.id DESC
    `) as [any[], any];

    console.log(`Found ${transactions.length} transactions that might need to be linked to invoices\n`);

    if (transactions.length === 0) {
      console.log('✅ No unlinked transactions found.');
      return;
    }

    // Step 2: For each transaction, try to find matching invoices
    console.log('📋 Step 2: Matching transactions to invoices...\n');
    
    let linkedCount = 0;
    let skippedCount = 0;
    const unlinkedTransactions: UnlinkedTransaction[] = [];

    for (const transaction of transactions) {
      const transactionId = transaction.transaction_id;
      const apartmentId = transaction.apartment_id;
      const amount = parseFloat(transaction.amount);
      const categoryId = transaction.category_id;
      const date = transaction.date;
      const description = transaction.description || '';

      console.log(`  Transaction ${transactionId}:`);
      console.log(`    Apartment: ${apartmentId}, Amount: $${amount.toFixed(2)}`);
      console.log(`    Category: ${transaction.category_name}`);
      console.log(`    Date: ${date}`);
      console.log(`    Description: ${description.substring(0, 50)}...`);

      // Check if invoice_transactions already exists for this transaction
      const [existingLinks] = await db.query(`
        SELECT COUNT(*) as count
        FROM invoice_transactions
        WHERE transaction_id = ?
      `, [transactionId]) as [any[], any];

      if (existingLinks[0]?.count > 0) {
        console.log(`    ⚠️  Already linked, skipping\n`);
        skippedCount++;
        continue;
      }

      // Find matching invoices for this apartment and category
      // Match by: same apartment, same category, invoice date <= transaction date, unpaid or partial
      // For common expenses, also try to match by year if description contains year info
      let yearFromDescription: number | null = null;
      const yearMatch = description.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        yearFromDescription = parseInt(yearMatch[1]);
      }

      let matchingInvoicesQuery = `
        SELECT 
          i.id,
          i.amount,
          i.invoice_date,
          i.due_date,
          i.year,
          COALESCE(SUM(it.amount), 0) as amount_paid
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE i.apartment_id = ?
        AND i.category_id = ?
        AND DATE(i.invoice_date) <= DATE(?)
      `;
      
      const queryParams: any[] = [apartmentId, categoryId, date];
      
      // If we found a year in description and category is common expenses, match by year too
      if (yearFromDescription && transaction.category_name?.toLowerCase().includes('common expense')) {
        matchingInvoicesQuery += ` AND i.year = ?`;
        queryParams.push(yearFromDescription);
      }
      
      matchingInvoicesQuery += `
        GROUP BY i.id, i.amount, i.invoice_date, i.due_date, i.year
        HAVING amount_paid < i.amount
        ORDER BY i.invoice_date DESC, i.id DESC
      `;
      
      const [matchingInvoices] = await db.query(matchingInvoicesQuery, queryParams) as [any[], any];

      if (matchingInvoices.length === 0) {
        console.log(`    ⚠️  No matching unpaid invoices found\n`);
        unlinkedTransactions.push({
          transactionId: transactionId,
          invoiceId: null,
          apartmentId: apartmentId,
          amount: amount,
          date: date,
          description: description,
          categoryId: categoryId
        });
        continue;
      }

      // Try to match to the most appropriate invoice
      // Strategy: Find invoice with closest amount or date
      let matchedInvoice = null;
      let remainingAmount = amount;

      for (const invoice of matchingInvoices) {
        const invoiceId = invoice.id;
        const invoiceAmount = parseFloat(invoice.amount);
        const amountPaid = parseFloat(invoice.amount_paid);
        const balance = invoiceAmount - amountPaid;

        if (balance > 0 && remainingAmount > 0) {
          const allocationAmount = Math.min(remainingAmount, balance);
          
          // Create invoice_transaction link
          await db.query(`
            INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
            VALUES (?, ?, ?, ?)
          `, [invoiceId, transactionId, apartmentId, allocationAmount]);

          console.log(`    ✅ Linked $${allocationAmount.toFixed(2)} to Invoice ${invoiceId} (Balance: $${balance.toFixed(2)})`);
          
          remainingAmount -= allocationAmount;
          linkedCount++;

          if (remainingAmount <= 0.01) {
            break; // Transaction fully allocated
          }
        }
      }

      // If there's remaining amount after allocating to invoices, it might be a credit
      if (remainingAmount > 0.01) {
        console.log(`    ⚠️  $${remainingAmount.toFixed(2)} remaining - could be credit or overpayment`);
        // Optionally create credit record
        // await db.query(`
        //   INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
        //   VALUES (NULL, ?, ?, ?)
        // `, [transactionId, apartmentId, remainingAmount]);
      }

      console.log('');
    }

    console.log(`\n✅ Linked ${linkedCount} transactions to invoices`);
    console.log(`⚠️  Skipped ${skippedCount} already linked transactions`);
    console.log(`⚠️  ${unlinkedTransactions.length} transactions couldn't be matched to invoices\n`);

    // Step 3: Show unlinked transactions for manual review
    if (unlinkedTransactions.length > 0) {
      console.log('📋 Step 3: Unlinked transactions (need manual review):\n');
      unlinkedTransactions.forEach((t) => {
        console.log(`  Transaction ${t.transactionId}: $${t.amount.toFixed(2)} for Apartment ${t.apartmentId} on ${t.date}`);
        console.log(`    Description: ${t.description.substring(0, 60)}...`);
      });
      console.log('');
    }

    // Step 4: Verify results
    console.log('📋 Step 4: Verifying results...\n');
    
    const [linkedStats] = await db.query(`
      SELECT 
        COUNT(DISTINCT it.transaction_id) as linked_transactions,
        COUNT(DISTINCT it.invoice_id) as linked_invoices,
        SUM(it.amount) as total_linked_amount
      FROM invoice_transactions it
      WHERE it.transaction_id IS NOT NULL
    `) as [any[], any];

    if (linkedStats.length > 0) {
      const stats = linkedStats[0];
      console.log(`  Linked transactions: ${stats.linked_transactions}`);
      console.log(`  Linked invoices: ${stats.linked_invoices}`);
      console.log(`  Total linked amount: $${parseFloat(stats.total_linked_amount || 0).toFixed(2)}\n`);
    }

    console.log('✅ Linking completed!\n');

  } catch (error) {
    console.error('❌ Linking failed:', error);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  linkTransactionsToInvoices()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { linkTransactionsToInvoices };

