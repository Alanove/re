/**
 * Add Apartment Invoices Menu Item
 * This script adds the invoice menu item to the admin_menu table
 */

import { db } from '../src/config/database';

async function addInvoiceMenuItem() {
  console.log('🚀 Adding Apartment Invoices menu item...\n');
  
  try {
    await db.testConnection();
    
    // Find the Accounting parent menu ID
    const [accountingRows] = await db.query(`
      SELECT id FROM admin_menu 
      WHERE url = '#' AND title LIKE '%Accounting%' 
      LIMIT 1
    `) as [any[], any];
    
    if (accountingRows.length === 0) {
      console.error('❌ Accounting menu item not found!');
      return;
    }
    
    const accountingParentId = accountingRows[0].id;
    console.log(`✅ Found Accounting menu with ID: ${accountingParentId}`);
    
    // Check if invoice menu item already exists
    const [existing] = await db.query(`
      SELECT id FROM admin_menu 
      WHERE url = '/admin/apartment-invoices'
    `) as [any[], any];
    
    if (existing.length > 0) {
      console.log('✅ Apartment Invoices menu item already exists (ID: ' + existing[0].id + ')');
      return;
    }
    
    // Get the max order_index for Accounting children
    const [maxOrder] = await db.query(`
      SELECT COALESCE(MAX(order_index), 0) + 1 as next_order
      FROM admin_menu 
      WHERE parent_id = ?
    `, [accountingParentId]) as [any[], any];
    
    const nextOrder = maxOrder[0].next_order;
    console.log(`   Next order index: ${nextOrder}`);
    
    // Insert the menu item
    const [result] = await db.query(`
      INSERT INTO admin_menu (
        title, 
        url, 
        parent_id, 
        order_index, 
        icon, 
        roles, 
        is_visible,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'Apartment Invoices',
      '/admin/apartment-invoices',
      accountingParentId,
      nextOrder,
      'fa fa-file-invoice-dollar',
      JSON.stringify(['Super Admin', 'Admin', 'Accounting']),
      1
    ]);
    
    const insertId = (result as any).insertId;
    console.log(`✅ Apartment Invoices menu item created with ID: ${insertId}`);
    
    // Verify it was created
    const [verify] = await db.query(`
      SELECT id, title, url, parent_id, order_index 
      FROM admin_menu 
      WHERE id = ?
    `, [insertId]) as [any[], any];
    
    if (verify.length > 0) {
      console.log('\n📋 Menu item details:');
      console.log(`   ID: ${verify[0].id}`);
      console.log(`   Title: ${verify[0].title}`);
      console.log(`   URL: ${verify[0].url}`);
      console.log(`   Parent ID: ${verify[0].parent_id}`);
      console.log(`   Order: ${verify[0].order_index}`);
    }
    
    console.log('\n🎉 Menu item added successfully!');
    console.log('   Please refresh your browser to see the new menu item.');
    
  } catch (error) {
    console.error('❌ Failed to add menu item:', error);
    throw error;
  } finally {
    await db.close();
  }
}

addInvoiceMenuItem().catch(console.error);

