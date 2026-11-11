/**
 * Smart Script: Link Transactions to Invoices Based on Backup Data
 * Date: 2025-01-17
 * Description: 
 * This script:
 * 1. Finds unsettled invoices (where current paid < expected paid from backup)
 * 2. Calculates the difference
 * 3. Finds unlinked transactions that match the difference
 * 4. Links them to invoices
 */

import { db } from '../src/config/database';

interface InvoiceMismatch {
  invoiceId: number;
  apartmentId: number;
  invoiceAmount: number;
  currentPaid: number;
  expectedPaid: number;
  difference: number;
  year: number | null;
  categoryId: number;
}

interface UnlinkedTransaction {
  transactionId: number;
  apartmentId: number | null;
  amount: number;
  date: string;
  description: string;
  categoryId: number;
  categoryName: string;
}

async function smartLinkTransactions() {
  console.log('🔧 Starting smart transaction-to-invoice linking...\n');

  try {
    // Step 1: Check if apartment_payments_backup exists
    const [backupCheck] = await db.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'apartment_payments_backup'
    `) as [any[], any];

    if (backupCheck[0]?.count === 0) {
      console.log('❌ apartment_payments_backup table not found. Cannot proceed without backup data.');
      return;
    }

    // Step 2: Find invoices with mismatched amounts
    console.log('📋 Step 1: Finding invoices with payment mismatches...\n');
    
    // Get Common Expenses category ID
    const [commonExpenseCategory] = await db.query(`
      SELECT id FROM transaction_categories WHERE LOWER(name) = 'common expenses' LIMIT 1
    `) as [any[], any];
    
    if (commonExpenseCategory.length === 0) {
      console.log('❌ Common Expenses category not found.');
      return;
    }
    
    const commonExpenseCategoryId = commonExpenseCategory[0].id;
    console.log(`Using Common Expenses category ID: ${commonExpenseCategoryId}\n`);

    // Get all invoices with their current paid amounts
    const [invoices] = await db.query(`
      SELECT 
        i.id,
        i.apartment_id,
        i.amount,
        i.year,
        i.category_id,
        COALESCE(SUM(it.amount), 0) as current_paid
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      WHERE i.category_id = ?
      GROUP BY i.id, i.apartment_id, i.amount, i.year, i.category_id
      HAVING current_paid < i.amount
      ORDER BY i.apartment_id, i.year
    `, [commonExpenseCategoryId]) as [any[], any];

    console.log(`Found ${invoices.length} unsettled invoices\n`);

    if (invoices.length === 0) {
      console.log('✅ No unsettled invoices found.');
      return;
    }

    // Step 3: Get expected amounts from backup
    console.log('📋 Step 2: Getting expected amounts from apartment_payments_backup...\n');
    
    const invoiceMismatches: InvoiceMismatch[] = [];
    
    for (const invoice of invoices) {
      const invoiceId = invoice.id;
      const apartmentId = invoice.apartment_id;
      const invoiceAmount = parseFloat(invoice.amount);
      const currentPaid = parseFloat(invoice.current_paid);
      const year = invoice.year;
      
      // Get expected amount from backup
      let expectedPaid = 0;
      
      if (year) {
        const [backupPayments] = await db.query(`
          SELECT ap.amount_paid
          FROM apartment_payments_backup ap
          LEFT JOIN common_expenses_settings ces ON ap.payment_id = ces.id
          WHERE ap.apartment_id = ?
          AND ces.year = ?
          LIMIT 1
        `, [apartmentId, year]) as [any[], any];
        
        if (backupPayments.length > 0) {
          expectedPaid = parseFloat(backupPayments[0].amount_paid || 0);
        }
      }
      
      const difference = expectedPaid - currentPaid;
      
      if (difference > 0.01) {
        invoiceMismatches.push({
          invoiceId: invoiceId,
          apartmentId: apartmentId,
          invoiceAmount: invoiceAmount,
          currentPaid: currentPaid,
          expectedPaid: expectedPaid,
          difference: difference,
          year: year,
          categoryId: invoice.category_id
        });
        
        console.log(`  Invoice ${invoiceId} (Apartment ${apartmentId}, Year ${year || 'N/A'}):`);
        console.log(`    Invoice Amount: $${invoiceAmount.toFixed(2)}`);
        console.log(`    Current Paid: $${currentPaid.toFixed(2)}`);
        console.log(`    Expected Paid: $${expectedPaid.toFixed(2)}`);
        console.log(`    Missing: $${difference.toFixed(2)}\n`);
      }
    }

    console.log(`Found ${invoiceMismatches.length} invoices with payment mismatches\n`);

    if (invoiceMismatches.length === 0) {
      console.log('✅ No mismatches found. All invoices match backup data.');
      return;
    }

    // Step 4: Get all unlinked Common Expenses transactions
    console.log('📋 Step 3: Finding unlinked Common Expenses transactions...\n');
    
    const [unlinkedTransactions] = await db.query(`
      SELECT 
        t.id as transaction_id,
        t.apartment_id,
        t.amount,
        t.date,
        t.description,
        t.category_id,
        tc.name as category_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN invoice_transactions it ON it.transaction_id = t.id
      WHERE t.category_id = ?
      AND t.type = 'income'
      AND it.id IS NULL
      AND (t.apartment_id IS NULL OR t.apartment_id = 0)
      ORDER BY t.date DESC, t.id DESC
    `, [commonExpenseCategoryId]) as [any[], any];

    console.log(`Found ${unlinkedTransactions.length} unlinked Common Expenses transactions\n`);

    // Step 5: Get apartment info for matching
    const [apartments] = await db.query(`
      SELECT id, floor, apartment_number, apartment_number_unofficial, owner_id, owner_name
      FROM apartments
    `) as [any[], any];

    const apartmentMap = new Map(apartments.map((apt: any) => [apt.id, apt]));

    // Step 6: Smart matching
    console.log('📋 Step 4: Matching transactions to invoices...\n');
    
    let linkedCount = 0;
    const matchedTransactions = new Set<number>();
    
    for (const mismatch of invoiceMismatches) {
      console.log(`  Looking for matches for Invoice ${mismatch.invoiceId} (Missing: $${mismatch.difference.toFixed(2)})...`);
      
      const apartment = apartmentMap.get(mismatch.apartmentId);
      if (!apartment) {
        console.log(`    ⚠️  Apartment ${mismatch.apartmentId} not found\n`);
        continue;
      }
      
      // Build search patterns for this apartment
      const block = apartment.floor; // floor is the block
      const unitOfficial = apartment.apartment_number;
      const unitUnofficial = apartment.apartment_number_unofficial;
      const ownerName = apartment.owner_name;
      
      // Try to find matching transactions
      const matchingTransactions: UnlinkedTransaction[] = [];
      
      for (const transaction of unlinkedTransactions) {
        if (matchedTransactions.has(transaction.transaction_id)) {
          continue; // Already matched
        }
        
        const transactionAmount = parseFloat(transaction.amount);
        const description = (transaction.description || '').toLowerCase();
        
        // Check if amount matches (within 0.01 tolerance)
        if (Math.abs(transactionAmount - mismatch.difference) > 0.01) {
          // Amount doesn't match exactly, but might be a partial match
          // Check if transaction amount is less than or equal to difference
          if (transactionAmount > mismatch.difference + 0.01) {
            continue; // Transaction is larger than what we need
          }
        }
        
        // Check if description contains apartment identifiers
        const hasBlock = block && description.includes(block.toLowerCase());
        const hasUnitOfficial = unitOfficial && description.includes(unitOfficial);
        const hasUnitUnofficial = unitUnofficial && description.includes(unitUnofficial?.toLowerCase() || '');
        
        // Also check for apartment number patterns like "B 13", "C 5", etc.
        const blockUnitPattern = new RegExp(`block\\s*${block}\\s*${unitOfficial}`, 'i');
        const hasBlockUnitPattern = blockUnitPattern.test(description);
        
        // Check for owner name in description (some transactions have owner names)
        const hasOwnerName = ownerName && description.includes(ownerName.toLowerCase().split(' ')[0]);
        
        // Check for year in description if invoice has a year
        let yearMatches = true;
        if (mismatch.year) {
          const yearPattern = new RegExp(`\\b${mismatch.year}\\b`);
          yearMatches = yearPattern.test(description) || !description.match(/\b20\d{2}\b/);
        }
        
        // Score the match
        let matchScore = 0;
        if (hasBlock) matchScore += 2;
        if (hasUnitOfficial) matchScore += 2;
        if (hasUnitUnofficial) matchScore += 1;
        if (hasBlockUnitPattern) matchScore += 3;
        if (hasOwnerName) matchScore += 1;
        if (yearMatches) matchScore += 1;
        if (Math.abs(transactionAmount - mismatch.difference) <= 0.01) matchScore += 5;
        else if (transactionAmount <= mismatch.difference) matchScore += 2;
        
        if (matchScore >= 3) { // Minimum threshold for a match
          matchingTransactions.push({
            transactionId: transaction.transaction_id,
            apartmentId: transaction.apartment_id,
            amount: transactionAmount,
            date: transaction.date,
            description: transaction.description,
            categoryId: transaction.category_id,
            categoryName: transaction.category_name
          });
        }
      }
      
      // Sort by match score (exact amount matches first)
      matchingTransactions.sort((a, b) => {
        const aExact = Math.abs(a.amount - mismatch.difference) <= 0.01 ? 1 : 0;
        const bExact = Math.abs(b.amount - mismatch.difference) <= 0.01 ? 1 : 0;
        return bExact - aExact;
      });
      
      // Link matching transactions
      let remainingDifference = mismatch.difference;
      
      for (const transaction of matchingTransactions) {
        if (remainingDifference <= 0.01) break;
        
        const allocationAmount = Math.min(transaction.amount, remainingDifference);
        
        // Check if this transaction is already linked
        const [existingLink] = await db.query(`
          SELECT COUNT(*) as count
          FROM invoice_transactions
          WHERE transaction_id = ?
        `, [transaction.transactionId]) as [any[], any];
        
        if (existingLink[0]?.count > 0) {
          console.log(`    ⚠️  Transaction ${transaction.transactionId} already linked, skipping`);
          continue;
        }
        
        // Create the link
        await db.query(`
          INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
          VALUES (?, ?, ?, ?)
        `, [mismatch.invoiceId, transaction.transactionId, mismatch.apartmentId, allocationAmount]);
        
        console.log(`    ✅ Linked Transaction ${transaction.transactionId} ($${allocationAmount.toFixed(2)})`);
        console.log(`       Description: ${transaction.description.substring(0, 60)}...`);
        
        matchedTransactions.add(transaction.transactionId);
        remainingDifference -= allocationAmount;
        linkedCount++;
        
        if (remainingDifference <= 0.01) {
          break; // Fully matched
        }
      }
      
      if (remainingDifference > 0.01) {
        console.log(`    ⚠️  Still missing $${remainingDifference.toFixed(2)}`);
      }
      
      console.log('');
    }

    console.log(`\n✅ Linked ${linkedCount} transactions to invoices\n`);

    // Step 7: Verify results
    console.log('📋 Step 5: Verifying results...\n');
    
    const [verificationResults] = await db.query(`
      SELECT 
        i.id as invoice_id,
        i.apartment_id,
        i.amount as invoice_amount,
        COALESCE(SUM(it.amount), 0) as current_paid,
        i.year
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      WHERE i.category_id = ?
      GROUP BY i.id, i.apartment_id, i.amount, i.year
      HAVING current_paid < i.amount
      ORDER BY i.apartment_id, i.year
    `, [commonExpenseCategoryId]) as [any[], any];

    if (verificationResults.length > 0) {
      console.log(`⚠️  ${verificationResults.length} invoices still have payment gaps:`);
      for (const result of verificationResults) {
        const invoiceAmount = parseFloat(result.invoice_amount);
        const currentPaid = parseFloat(result.current_paid);
        const balance = invoiceAmount - currentPaid;
        console.log(`  Invoice ${result.invoice_id} (Apartment ${result.apartment_id}, Year ${result.year || 'N/A'}):`);
        console.log(`    Amount: $${invoiceAmount.toFixed(2)}, Paid: $${currentPaid.toFixed(2)}, Balance: $${balance.toFixed(2)}`);
      }
      console.log('');
    } else {
      console.log('✅ All invoices are now fully paid!\n');
    }

    console.log('✅ Smart linking completed!\n');

  } catch (error) {
    console.error('❌ Smart linking failed:', error);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  smartLinkTransactions()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { smartLinkTransactions };

