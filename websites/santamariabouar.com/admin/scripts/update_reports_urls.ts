
import { db } from '../../src/config/database';

async function updateReportUrls() {
  try {
    console.log('Starting report URLs update...');

    const updates = [
      {
        oldUrl: '/admin/transactions/report/by-category',
        newUrl: '/admin/reports/transactions-by-category',
        title: 'Transactions by Category'
      },
      {
        oldUrl: '/admin/transactions/report/chronological',
        newUrl: '/admin/reports/transactions-chronological',
        title: 'Chronological Transactions'
      },
      {
        oldUrl: '/admin/common-expenses/unpaid-report',
        newUrl: '/admin/reports/unpaid-report',
        title: 'Unpaid Common Expenses'
      }
    ];

    for (const update of updates) {
      console.log(`Updating "${update.title}"...`);
      
      // Check if item exists with old URL
      const [rows] = await db.query('SELECT * FROM admin_menu WHERE url = ?', [update.oldUrl]);
      const items = rows as any[];
      
      if (items.length > 0) {
        // Update URL
        await db.query('UPDATE admin_menu SET url = ? WHERE url = ?', [update.newUrl, update.oldUrl]);
        console.log(`✅ Updated URL for "${update.title}" from "${update.oldUrl}" to "${update.newUrl}"`);
      } else {
        // Check if already updated
        const [newRows] = await db.query('SELECT * FROM admin_menu WHERE url = ?', [update.newUrl]);
        if ((newRows as any[]).length > 0) {
          console.log(`ℹ️ "${update.title}" is already updated to "${update.newUrl}"`);
        } else {
          console.warn(`⚠️ Could not find menu item for "${update.title}" with old URL "${update.oldUrl}"`);
        }
      }
    }

    console.log('Report URLs update completed.');
  } catch (error) {
    console.error('Error updating report URLs:', error);
  } finally {
    process.exit();
  }
}

updateReportUrls();
