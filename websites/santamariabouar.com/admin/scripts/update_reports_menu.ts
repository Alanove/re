
import { db } from '../../src/config/database';
import { adminMenuService } from '../services/adminMenuService';

async function updateMenu() {
  try {
    console.log('Starting menu update...');

    // 1. Create "Reports" top-level menu item
    const allItems = await adminMenuService.getAllMenuItems();
    let reportsItem = allItems.find(item => item.title === 'Reports' && item.parentId === null);

    if (!reportsItem) {
      console.log('Creating "Reports" menu item...');
      // Find the highest order index to append at the end, or set a specific one
      const maxOrder = allItems.reduce((max, item) => (item.parentId === null ? Math.max(max, item.order) : max), 0);
      
      reportsItem = await adminMenuService.createMenuItem({
        title: 'Reports',
        url: 'javascript:;', // Submenu parent usually has javascript:;
        parentId: null,
        order: maxOrder + 10,
        icon: 'fa fa-chart-bar', // Suitable icon for reports
        roles: [], // Empty means visible to all authorized roles usually, or check adminMenuService logic
        isVisible: true
      });
      console.log('Created "Reports" item with ID:', reportsItem.id);
    } else {
      console.log('"Reports" item already exists with ID:', reportsItem.id);
    }

    // 2. Create sub-items
    const subItems = [
      {
        title: 'Transactions by Category',
        url: '/admin/transactions/report/by-category',
        icon: 'fa fa-tags'
      },
      {
        title: 'Chronological Transactions',
        url: '/admin/transactions/report/chronological',
        icon: 'fa fa-calendar'
      },
      {
        title: 'Unpaid Common Expenses',
        url: '/admin/common-expenses/unpaid-report',
        icon: 'fa fa-exclamation-circle'
      }
    ];

    for (const [index, subItem] of subItems.entries()) {
        // Check if it already exists under Reports
        // Note: getAllMenuItems returns a hierarchical structure, but we can also use flattening logic or re-fetch
        // Let's simple check if we can find it in the children of reportsItem if it was fetched with children, 
        // OR just query the DB. Since reportsItem from getAllMenuItems has children populated:
        
        // Refresh reportsItem to get latest children if we just created it or added items
        // getMenuItemById doesn't return children structure in the same way getAllMenuItems might? 
        // adminMenuService.getMenuItemById returns a single item.
        // Let's filter allItems again or just query.
        
        // To be safe against duplicates, let's fetch all items again to check existence.
        // But getAllMenuItems is cached? No, it queries DB.
        
        const currentItems = await adminMenuService.getAllMenuItems();
        const currentReportsItem = currentItems.find(i => i.id === reportsItem!.id) as any;
        
        const exists = currentReportsItem?.children?.find((child: any) => child.url === subItem.url);

        if (!exists) {
            console.log(`Creating "${subItem.title}"...`);
            await adminMenuService.createMenuItem({
                title: subItem.title,
                url: subItem.url,
                parentId: reportsItem.id,
                order: index + 1,
                icon: subItem.icon,
                roles: [],
                isVisible: true
            });
            console.log(`Created "${subItem.title}"`);
        } else {
            console.log(`"${subItem.title}" already exists.`);
        }
    }

    console.log('Menu update completed.');
  } catch (error) {
    console.error('Error updating menu:', error);
  } finally {
    process.exit();
  }
}

updateMenu();
