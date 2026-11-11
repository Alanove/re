
import { db } from '../../src/config/database';
import { adminMenuService } from '../services/adminMenuService';

async function removeOldUnpaidReport() {
  try {
    console.log('Starting menu cleanup...');

    // Fetch all menu items (flat list from DB primarily, but service returns tree, 
    // but we can also use internal methods if exposed, or just filter the tree)
    // Actually, let's use the DB directly to find it reliably or use getAllMenuItems and search the tree.
    // Using getAllMenuItems is safer as it uses the service logic.

    const allItems = await adminMenuService.getAllMenuItems();
    
    // Find "Reports" menu item to exclude its children
    const reportsItem = allItems.find(item => item.title === 'Reports');
    const reportsId = reportsItem ? reportsItem.id : -1;

    console.log(`Reports menu ID: ${reportsId}`);

    // We want to find the item with url '/admin/common-expenses/unpaid-report'
    // that is NOT a child of reportsId.

    let targetId = -1;
    let parentIdMatches = -1;

    // Helper to traverse
    function findTarget(items: any[]) {
      for (const item of items) {
        if (item.url === '/admin/common-expenses/unpaid-report') {
          if (item.parentId !== reportsId) {
             console.log(`Found target item: "${item.title}" (ID: ${item.id}) with Parent ID: ${item.parentId}`);
             targetId = item.id;
             return;
          } else {
             console.log(`Found item in Reports (Safe): "${item.title}" (ID: ${item.id})`);
          }
        }
        if (item.children && item.children.length > 0) {
          findTarget(item.children);
        }
      }
    }

    findTarget(allItems);

    if (targetId !== -1) {
      console.log(`Deleting item ID: ${targetId}...`);
      const success = await adminMenuService.deleteMenuItem(targetId);
      if (success) {
        console.log('✅ Successfully deleted duplicate menu item.');
      } else {
        console.error('❌ Failed to delete menu item.');
      }
    } else {
      console.log('ℹ️ No duplicate item found. It might have been already removed.');
    }

    console.log('Menu cleanup completed.');
  } catch (error) {
    console.error('Error removing menu item:', error);
  } finally {
    process.exit();
  }
}

removeOldUnpaidReport();
