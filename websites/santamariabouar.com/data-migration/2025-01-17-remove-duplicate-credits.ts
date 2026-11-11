/**
 * Remove Duplicate Credits
 * Date: 2025-01-17
 * Description: 
 * After fixing credits that were incorrectly migrated as invoices,
 * we need to remove duplicate credit records that were created.
 * This script identifies and removes duplicate credits.
 */

import { db } from '../src/config/database';

async function removeDuplicateCredits() {
  console.log('🔧 Removing duplicate credits...\n');

  try {
    // Step 1: Find apartments with multiple credit records
    console.log('📋 Step 1: Finding apartments with multiple credit records...\n');
    
    const [apartmentsWithCredits] = await db.query(`
      SELECT 
        apartment_id,
        COUNT(*) as credit_count,
        SUM(amount) as total_credit,
        GROUP_CONCAT(id ORDER BY created_at ASC) as credit_ids,
        GROUP_CONCAT(amount ORDER BY created_at ASC) as credit_amounts
      FROM invoice_transactions
      WHERE invoice_id IS NULL
      GROUP BY apartment_id
      HAVING credit_count > 1
      ORDER BY apartment_id
    `) as [any[], any];

    console.log(`Found ${apartmentsWithCredits.length} apartments with multiple credit records:\n`);

    if (apartmentsWithCredits.length === 0) {
      console.log('✅ No duplicate credits found.\n');
      return;
    }

    // Step 2: Get apartment information
    const apartmentIds = apartmentsWithCredits.map((apt: any) => apt.apartment_id);
    const [apartments] = await db.query(`
      SELECT id, owner_name, floor, apartment_number, apartment_number_unofficial
      FROM apartments
      WHERE id IN (${apartmentIds.map(() => '?').join(',')})
    `, apartmentIds) as [any[], any];

    const apartmentMap = new Map(apartments.map((apt: any) => [apt.id, apt]));

    // Step 3: Analyze and remove duplicates
    console.log('📋 Step 2: Analyzing and removing duplicate credits...\n');
    
    let removedCount = 0;
    let totalRemoved = 0;

    for (const aptCredit of apartmentsWithCredits) {
      const apartmentId = aptCredit.apartment_id;
      const apartment = apartmentMap.get(apartmentId);
      const creditIds = aptCredit.credit_ids.split(',').map((id: string) => parseInt(id));
      const creditAmounts = aptCredit.credit_amounts.split(',').map((amt: string) => parseFloat(amt));
      const totalCredit = parseFloat(aptCredit.total_credit);

      console.log(`  Apartment ${apartmentId} (${apartment?.owner_name || 'Unknown'}):`);
      console.log(`    Credit Records: ${aptCredit.credit_count}`);
      console.log(`    Total Credit: $${totalCredit.toFixed(2)}`);
      console.log(`    Credit Amounts: ${creditAmounts.map((a: number) => `$${a.toFixed(2)}`).join(', ')}`);

      // Get all credit records for this apartment with details
      const [creditRecords] = await db.query(`
        SELECT id, amount, created_at
        FROM invoice_transactions
        WHERE invoice_id IS NULL
          AND apartment_id = ?
        ORDER BY created_at ASC
      `, [apartmentId]) as [any[], any];

      // Group by amount to find duplicates
      const amountGroups = new Map<number, any[]>();
      creditRecords.forEach((record: any) => {
        const amount = parseFloat(record.amount);
        if (!amountGroups.has(amount)) {
          amountGroups.set(amount, []);
        }
        amountGroups.get(amount)!.push(record);
      });

      // For each amount group, if there are duplicates, keep the oldest and remove the rest
      let duplicatesRemoved = 0;
      for (const [amount, records] of amountGroups.entries()) {
        if (records.length > 1) {
          console.log(`    ⚠️  Found ${records.length} credit records with amount $${amount.toFixed(2)}`);
          
          // Keep the oldest (first) record, remove the rest
          const toKeep = records[0];
          const toRemove = records.slice(1);
          
          console.log(`    ✅ Keeping credit record ${toKeep.id} (created: ${toKeep.created_at})`);
          
          for (const record of toRemove) {
            await db.query(`DELETE FROM invoice_transactions WHERE id = ?`, [record.id]);
            console.log(`    🗑️  Removed duplicate credit record ${record.id} (created: ${record.created_at})`);
            duplicatesRemoved++;
            totalRemoved += parseFloat(record.amount);
          }
        }
      }

      if (duplicatesRemoved > 0) {
        removedCount += duplicatesRemoved;
        console.log(`    📊 Removed ${duplicatesRemoved} duplicate credit record(s)\n`);
      } else {
        console.log(`    ℹ️  No exact duplicates found (amounts are different)\n`);
      }
    }

    console.log(`\n✅ Duplicate removal completed!`);
    console.log(`   Removed ${removedCount} duplicate credit records`);
    console.log(`   Total amount removed: $${totalRemoved.toFixed(2)}\n`);

    // Step 4: Verify final state
    console.log('📋 Step 3: Verifying final credit state...\n');
    
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

    console.log(`Final credit summary:\n`);
    finalCredits.forEach((credit: any) => {
      const apt = apartmentMap.get(credit.apartment_id);
      console.log(`  Apartment ${credit.apartment_id} (${apt?.owner_name || 'Unknown'}):`);
      console.log(`    Credit Records: ${credit.credit_count}`);
      console.log(`    Total Credit: $${parseFloat(credit.total_credit).toFixed(2)}\n`);
    });

    console.log('✅ Fix completed!\n');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  removeDuplicateCredits()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { removeDuplicateCredits };

