/**
 * Verify Invoice Migration
 * This script verifies that the migration was successful
 */

import { db } from '../src/config/database';

async function verifyMigration() {
  console.log('🔍 Verifying invoice migration...\n');
  
  try {
    await db.testConnection();
    
    // Check invoice counts
    const [invoiceStats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN invoice_type = 'common_expense' THEN 1 ELSE 0 END) as common_expense,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
        SUM(amount) as total_amount,
        SUM(amount_paid) as total_paid
      FROM apartment_invoices
    `) as [any[], any];
    
    const [paymentStats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_paid
      FROM apartment_payments
    `) as [any[], any];
    
    console.log('📊 Invoice Statistics:');
    console.log(`   Total invoices: ${invoiceStats[0].total}`);
    console.log(`   Common expense invoices: ${invoiceStats[0].common_expense}`);
    console.log(`   Paid: ${invoiceStats[0].paid}`);
    console.log(`   Partial: ${invoiceStats[0].partial}`);
    console.log(`   Unpaid: ${invoiceStats[0].unpaid}`);
    console.log(`   Total amount: $${parseFloat(invoiceStats[0].total_amount || 0).toFixed(2)}`);
    console.log(`   Total paid: $${parseFloat(invoiceStats[0].total_paid || 0).toFixed(2)}`);
    
    console.log('\n📊 Apartment Payments (Preserved):');
    console.log(`   Total payments: ${paymentStats[0].total}`);
    console.log(`   Total due: $${parseFloat(paymentStats[0].total_due || 0).toFixed(2)}`);
    console.log(`   Total paid: $${parseFloat(paymentStats[0].total_paid || 0).toFixed(2)}`);
    
    // Sample invoices
    console.log('\n📋 Sample Invoices (first 5):');
    const [samples] = await db.query(`
      SELECT 
        ai.id,
        ai.apartment_id,
        a.floor as block,
        a.apartment_number,
        ai.year,
        ai.amount,
        ai.amount_paid,
        ai.status,
        ai.description
      FROM apartment_invoices ai
      LEFT JOIN apartments a ON ai.apartment_id = a.id
      WHERE ai.invoice_type = 'common_expense'
      ORDER BY ai.id
      LIMIT 5
    `) as [any[], any];
    
    samples.forEach((invoice: any) => {
      console.log(`   Invoice #${invoice.id}: Block ${invoice.block} ${invoice.apartment_number} - Year ${invoice.year} - $${parseFloat(invoice.amount).toFixed(2)} (${invoice.status})`);
    });
    
    // Check transactions with invoice_id
    const [transactionStats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN invoice_id IS NOT NULL THEN 1 ELSE 0 END) as with_invoice
      FROM transactions
    `) as [any[], any];
    
    console.log('\n📊 Transaction Statistics:');
    console.log(`   Total transactions: ${transactionStats[0].total}`);
    console.log(`   Transactions with invoice_id: ${transactionStats[0].with_invoice}`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

verifyMigration().catch(console.error);

