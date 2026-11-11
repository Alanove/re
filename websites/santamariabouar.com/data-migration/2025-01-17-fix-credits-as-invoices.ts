/**
 * Fix Credits That Were Incorrectly Migrated as Invoices
 * Date: 2025-01-17
 * Description: 
 * Some credits (overpayments) were incorrectly created as invoices during migration.
 * This script:
 * 1. Identifies small invoices that are actually credits
 * 2. Converts them to proper credit records in invoice_transactions (invoice_id = NULL)
 * 3. Deletes the incorrect invoice records
 * 4. Preserves the credit amounts for future use
 */

import { db } from '../src/config/database';

async function fixCreditsAsInvoices() {
  console.log('🔧 Fixing credits that were incorrectly migrated as invoices...\n');

  try {
    // Step 1: Find invoices that look like credits
    // These are typically small amounts with year = 0 or NULL, and description contains "Migrated"
    console.log('📋 Step 1: Finding invoices that are actually credits...\n');
    
    const [creditInvoices] = await db.query(`
      SELECT 
        i.id,
        i.apartment_id,
        i.amount,
        i.description,
        i.year,
        i.category_id,
        COALESCE(SUM(it.amount), 0) as amount_paid,
        (i.amount - COALESCE(SUM(it.amount), 0)) as outstanding_amount
      FROM invoices i
      LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
      WHERE (i.year = 0 OR i.year IS NULL)
        AND (i.description LIKE '%Migrated%' OR i.description LIKE '%Common Expenses 0%')
        AND i.amount > 0
        AND i.amount < 100
      GROUP BY i.id, i.apartment_id, i.amount, i.description, i.year, i.category_id
      HAVING COALESCE(SUM(it.amount), 0) = 0
      ORDER BY i.apartment_id, i.amount
    `) as [any[], any];

    console.log(`Found ${creditInvoices.length} invoices that appear to be credits:\n`);
    
    if (creditInvoices.length === 0) {
      console.log('✅ No credit invoices found. Nothing to fix.\n');
      return;
    }

    // Display what we found
    creditInvoices.forEach(inv => {
      console.log(`  Invoice ${inv.id}: Apartment ${inv.apartment_id}, Amount: $${parseFloat(inv.amount).toFixed(2)}`);
      console.log(`    Description: ${inv.description || 'N/A'}`);
      console.log(`    Year: ${inv.year || 'NULL'}`);
      console.log('');
    });

    // Step 2: Get apartment information for verification
    console.log('📋 Step 2: Verifying apartments and preparing credit records...\n');
    
    const apartmentIds = [...new Set(creditInvoices.map(inv => inv.apartment_id))];
    const [apartments] = await db.query(`
      SELECT id, owner_name, floor, apartment_number, apartment_number_unofficial
      FROM apartments
      WHERE id IN (${apartmentIds.map(() => '?').join(',')})
    `, apartmentIds) as [any[], any];

    const apartmentMap = new Map(apartments.map((apt: any) => [apt.id, apt]));

    // Step 3: Check existing credits for these apartments
    console.log('📋 Step 3: Checking existing credits for these apartments...\n');
    
    const [existingCredits] = await db.query(`
      SELECT 
        apartment_id,
        SUM(amount) as total_credit
      FROM invoice_transactions
      WHERE invoice_id IS NULL
        AND apartment_id IN (${apartmentIds.map(() => '?').join(',')})
      GROUP BY apartment_id
    `, apartmentIds) as [any[], any];

    const existingCreditsMap = new Map(
      existingCredits.map((ec: any) => [ec.apartment_id, parseFloat(ec.total_credit || 0)])
    );

    // Step 4: Convert invoices to credits
    console.log('📋 Step 4: Converting invoices to credits...\n');
    
    let convertedCount = 0;
    let totalCreditAmount = 0;

    for (const invoice of creditInvoices) {
      const apartmentId = invoice.apartment_id;
      const creditAmount = parseFloat(invoice.amount);
      const apartment = apartmentMap.get(apartmentId);
      const existingCredit = existingCreditsMap.get(apartmentId) || 0;

      console.log(`  Processing Invoice ${invoice.id} (Apartment ${apartmentId}):`);
      console.log(`    Apartment: ${apartment?.owner_name || 'Unknown'} - Block ${apartment?.floor || 'N/A'} - ${apartment?.apartment_number || 'N/A'}`);
      console.log(`    Credit Amount: $${creditAmount.toFixed(2)}`);
      console.log(`    Existing Credit: $${existingCredit.toFixed(2)}`);

      // Check if there are any invoice_transactions linked to this invoice
      const [linkedTransactions] = await db.query(`
        SELECT COUNT(*) as count, SUM(amount) as total
        FROM invoice_transactions
        WHERE invoice_id = ?
      `, [invoice.id]) as [any[], any];

      const linkedCount = linkedTransactions[0]?.count || 0;
      const linkedTotal = parseFloat(linkedTransactions[0]?.total || 0);

      if (linkedCount > 0) {
        console.log(`    ⚠️  Invoice has ${linkedCount} linked transactions (total: $${linkedTotal.toFixed(2)})`);
        console.log(`    ⚠️  This might not be a credit. Skipping for safety.\n`);
        continue;
      }

      // Check if this credit amount already exists in invoice_transactions (to avoid duplicates)
      // Look for credits with the same amount for this apartment
      const [matchingCredits] = await db.query(`
        SELECT id, amount
        FROM invoice_transactions
        WHERE invoice_id IS NULL
          AND apartment_id = ?
          AND ABS(amount - ?) < 0.01
        ORDER BY created_at ASC
      `, [apartmentId, creditAmount]) as [any[], any];

      if (matchingCredits.length > 0) {
        console.log(`    ⚠️  Credit of $${creditAmount.toFixed(2)} already exists (${matchingCredits.length} record(s))`);
        console.log(`    ℹ️  This invoice is a duplicate of an existing credit. Just deleting the invoice.\n`);
        
        // Just delete the invoice, don't create a duplicate credit
        await db.query(`DELETE FROM invoices WHERE id = ?`, [invoice.id]);
        console.log(`    ✅ Deleted duplicate invoice record (credit already exists)\n`);
      } else {
        // Create credit record in invoice_transactions only if it doesn't already exist
        await db.query(`
          INSERT INTO invoice_transactions (invoice_id, transaction_id, apartment_id, amount)
          VALUES (NULL, NULL, ?, ?)
        `, [apartmentId, creditAmount]);

        console.log(`    ✅ Created credit record: $${creditAmount.toFixed(2)}`);

        // Delete the incorrect invoice
        await db.query(`DELETE FROM invoices WHERE id = ?`, [invoice.id]);
        console.log(`    ✅ Deleted incorrect invoice record`);

        // Update existing credit total
        const newTotal = existingCredit + creditAmount;
        existingCreditsMap.set(apartmentId, newTotal);
        console.log(`    📊 New total credit for apartment: $${newTotal.toFixed(2)}\n`);
      }

      convertedCount++;
      totalCreditAmount += creditAmount;
    }

    console.log(`\n✅ Conversion completed!`);
    console.log(`   Converted ${convertedCount} invoices to credits`);
    console.log(`   Total credit amount preserved: $${totalCreditAmount.toFixed(2)}\n`);

    // Step 5: Verify the fix
    console.log('📋 Step 5: Verifying credits...\n');
    
    const [finalCredits] = await db.query(`
      SELECT 
        apartment_id,
        COUNT(*) as credit_count,
        SUM(amount) as total_credit
      FROM invoice_transactions
      WHERE invoice_id IS NULL
        AND apartment_id IN (${apartmentIds.map(() => '?').join(',')})
      GROUP BY apartment_id
      ORDER BY apartment_id
    `, apartmentIds) as [any[], any];

    console.log(`Final credit summary for affected apartments:\n`);
    finalCredits.forEach((credit: any) => {
      const apt = apartmentMap.get(credit.apartment_id);
      console.log(`  Apartment ${credit.apartment_id} (${apt?.owner_name || 'Unknown'}):`);
      console.log(`    Credit Records: ${credit.credit_count}`);
      console.log(`    Total Credit: $${parseFloat(credit.total_credit).toFixed(2)}\n`);
    });

    // Step 6: Check if any credit invoices remain
    const [remainingCreditInvoices] = await db.query(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE (year = 0 OR year IS NULL)
        AND (description LIKE '%Migrated%' OR description LIKE '%Common Expenses 0%')
        AND amount > 0
        AND amount < 100
    `) as [any[], any];

    const remainingCount = remainingCreditInvoices[0]?.count || 0;
    if (remainingCount > 0) {
      console.log(`⚠️  ${remainingCount} credit invoices still remain. They may have linked transactions.\n`);
    } else {
      console.log(`✅ All credit invoices have been converted!\n`);
    }

    console.log('✅ Fix completed!\n');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixCreditsAsInvoices()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { fixCreditsAsInvoices };

