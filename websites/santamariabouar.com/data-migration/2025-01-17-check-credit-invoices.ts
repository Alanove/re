/**
 * Check Credit Invoices
 * Date: 2025-01-17
 * Description: Check invoices that are showing as credits in the unpaid report
 */

import { db } from '../src/config/database';

async function checkCreditInvoices() {
  console.log('🔍 Checking invoices that appear as credits...\n');

  try {
    // Get apartments mentioned by the user
    const apartmentNames = [
      'Elie Abou Hamad',
      'Noura Ohannessian',
      'Joseph Abi Kheirs',
      'Randa Chidiac',
      'Badih Bou Rjeily',
      'Camile Chidiac',
      'Gemayel Armale',
      'Mostafa Itani'
    ];

    // Find apartment IDs using OR conditions
    const likeConditions = apartmentNames.map(() => 'owner_name LIKE ?').join(' OR ');
    const [apartments] = await db.query(`
      SELECT id, owner_name, floor, apartment_number, apartment_number_unofficial
      FROM apartments
      WHERE ${likeConditions}
    `, apartmentNames.map(name => `%${name}%`)) as [any[], any];

    console.log(`Found ${apartments.length} apartments:\n`);
    apartments.forEach(apt => {
      console.log(`  Apartment ${apt.id}: ${apt.owner_name} - Block ${apt.floor} - ${apt.apartment_number} (${apt.apartment_number_unofficial})`);
    });

    if (apartments.length === 0) {
      console.log('\n⚠️  No apartments found. Trying different search...\n');
      
      // Try finding by unit numbers
      const [apartmentsByUnit] = await db.query(`
        SELECT id, owner_name, floor, apartment_number, apartment_number_unofficial
        FROM apartments
        WHERE (floor = 'B' AND apartment_number IN ('12', '9'))
           OR (floor = 'D' AND apartment_number = '14')
           OR (floor = 'E' AND apartment_number IN ('12', '10'))
           OR (floor = 'F' AND apartment_number IN ('14', '7'))
           OR (floor = 'G' AND apartment_number = '8')
      `) as [any[], any];

      console.log(`Found ${apartmentsByUnit.length} apartments by unit:\n`);
      apartmentsByUnit.forEach(apt => {
        console.log(`  Apartment ${apt.id}: ${apt.owner_name} - Block ${apt.floor} - ${apt.apartment_number} (${apt.apartment_number_unofficial})`);
      });

      if (apartmentsByUnit.length > 0) {
        const apartmentIds = apartmentsByUnit.map(a => a.id);
        
        // Get invoices for these apartments
        const [invoices] = await db.query(`
          SELECT 
            i.id,
            i.apartment_id,
            i.amount,
            i.description,
            i.year,
            COALESCE(SUM(it.amount), 0) as amount_paid,
            (i.amount - COALESCE(SUM(it.amount), 0)) as outstanding_amount,
            CASE 
              WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
              WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
              ELSE 'unpaid'
            END as status
          FROM invoices i
          LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
          WHERE i.apartment_id IN (${apartmentIds.map(() => '?').join(',')})
          GROUP BY i.id, i.apartment_id, i.amount, i.description, i.year
          HAVING (i.amount - COALESCE(SUM(it.amount), 0)) < 0
          ORDER BY i.apartment_id, i.year
        `, apartmentIds) as [any[], any];

        console.log(`\n📋 Found ${invoices.length} invoices with negative outstanding amounts (credits):\n`);
        invoices.forEach(inv => {
          const apt = apartmentsByUnit.find(a => a.id === inv.apartment_id);
          console.log(`  Invoice ${inv.id}:`);
          console.log(`    Apartment: ${apt?.owner_name} - Block ${apt?.floor} - ${apt?.apartment_number}`);
          console.log(`    Amount: $${parseFloat(inv.amount).toFixed(2)}`);
          console.log(`    Amount Paid: $${parseFloat(inv.amount_paid).toFixed(2)}`);
          console.log(`    Outstanding: $${parseFloat(inv.outstanding_amount).toFixed(2)}`);
          console.log(`    Status: ${inv.status}`);
          console.log(`    Description: ${inv.description || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      const apartmentIds = apartments.map(a => a.id);
      
      // Get ALL invoices for these apartments (not just negative ones)
      const [allInvoices] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id,
          i.amount,
          i.description,
          i.year,
          i.category_id,
          COALESCE(SUM(it.amount), 0) as amount_paid,
          (i.amount - COALESCE(SUM(it.amount), 0)) as outstanding_amount,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE i.apartment_id IN (${apartmentIds.map(() => '?').join(',')})
        GROUP BY i.id, i.apartment_id, i.amount, i.description, i.year, i.category_id
        ORDER BY i.apartment_id, i.year, i.id
      `, apartmentIds) as [any[], any];

      console.log(`\n📋 Found ${allInvoices.length} total invoices for these apartments:\n`);
      allInvoices.forEach(inv => {
        const apt = apartments.find(a => a.id === inv.apartment_id);
        const outstanding = parseFloat(inv.outstanding_amount);
        const isCredit = outstanding < 0 || parseFloat(inv.amount_paid) >= parseFloat(inv.amount);
        const marker = isCredit ? ' ⚠️ CREDIT' : '';
        console.log(`  Invoice ${inv.id}${marker}:`);
        console.log(`    Apartment: ${apt?.owner_name} - Block ${apt?.floor} - ${apt?.apartment_number}`);
        console.log(`    Amount: $${parseFloat(inv.amount).toFixed(2)}`);
        console.log(`    Amount Paid: $${parseFloat(inv.amount_paid).toFixed(2)}`);
        console.log(`    Outstanding: $${outstanding.toFixed(2)}`);
        console.log(`    Status: ${inv.status}`);
        console.log(`    Category ID: ${inv.category_id}`);
        console.log(`    Description: ${inv.description || 'N/A'}`);
        console.log('');
      });

      // Now check for negative ones specifically
      const [invoices] = await db.query(`
        SELECT 
          i.id,
          i.apartment_id,
          i.amount,
          i.description,
          i.year,
          COALESCE(SUM(it.amount), 0) as amount_paid,
          (i.amount - COALESCE(SUM(it.amount), 0)) as outstanding_amount,
          CASE 
            WHEN COALESCE(SUM(it.amount), 0) >= i.amount THEN 'paid'
            WHEN COALESCE(SUM(it.amount), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END as status
        FROM invoices i
        LEFT JOIN invoice_transactions it ON it.invoice_id = i.id
        WHERE i.apartment_id IN (${apartmentIds.map(() => '?').join(',')})
        GROUP BY i.id, i.apartment_id, i.amount, i.description, i.year
        HAVING (i.amount - COALESCE(SUM(it.amount), 0)) < 0
        ORDER BY i.apartment_id, i.year
      `, apartmentIds) as [any[], any];

      console.log(`\n📋 Found ${invoices.length} invoices with negative outstanding amounts (credits):\n`);
      invoices.forEach(inv => {
        const apt = apartments.find(a => a.id === inv.apartment_id);
        console.log(`  Invoice ${inv.id}:`);
        console.log(`    Apartment: ${apt?.owner_name} - Block ${apt?.floor} - ${apt?.apartment_number}`);
        console.log(`    Amount: $${parseFloat(inv.amount).toFixed(2)}`);
        console.log(`    Amount Paid: $${parseFloat(inv.amount_paid).toFixed(2)}`);
        console.log(`    Outstanding: $${parseFloat(inv.outstanding_amount).toFixed(2)}`);
        console.log(`    Status: ${inv.status}`);
        console.log(`    Description: ${inv.description || 'N/A'}`);
        console.log('');
      });
    }

    console.log('✅ Check completed!\n');

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkCreditInvoices()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { checkCreditInvoices };

