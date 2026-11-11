/**
 * Verify Invoice Menu Item
 */

import { db } from '../src/config/database';

async function verifyMenuItem() {
  try {
    await db.testConnection();
    
    // Get all Accounting menu items
    const [accountingItems] = await db.query(`
      SELECT 
        id,
        title,
        url,
        order_index,
        icon,
        is_visible
      FROM admin_menu
      WHERE parent_id = (
        SELECT id FROM admin_menu WHERE url = '#' AND title LIKE '%Accounting%' LIMIT 1
      )
      ORDER BY order_index
    `) as [any[], any];
    
    console.log('\n📋 Accounting Menu Items:');
    console.log('='.repeat(60));
    accountingItems.forEach((item: any) => {
      const status = item.is_visible ? '✅' : '❌';
      console.log(`${status} [${item.order_index}] ${item.title}`);
      console.log(`     URL: ${item.url}`);
      console.log(`     Icon: ${item.icon}`);
      console.log('');
    });
    
    // Check specifically for invoices
    const [invoiceItem] = await db.query(`
      SELECT * FROM admin_menu 
      WHERE url = '/admin/apartment-invoices'
    `) as [any[], any];
    
    if (invoiceItem.length > 0) {
      console.log('✅ Apartment Invoices menu item found!');
      console.log(`   ID: ${invoiceItem[0].id}`);
      console.log(`   Visible: ${invoiceItem[0].is_visible ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Apartment Invoices menu item NOT found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

verifyMenuItem().catch(console.error);

