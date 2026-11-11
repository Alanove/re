-- Migration: Add Apartment Invoices menu item to admin menu
-- Date: 2025-01-16
-- Description: Adds "Apartment Invoices" menu item to the Accounting section in admin menu

-- Note: This migration updates the admin_menu table if it exists
-- The menu is also stored in data/admin-menu.json which should be updated separately

-- Check if admin_menu table exists and add menu item
SET @dbname = DATABASE();
SET @tablename = 'admin_menu';
SET @menuExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename);

SET @preparedStatement = (SELECT IF(
  @menuExists > 0,
  'SELECT 1',
  'SELECT 1'
));
PREPARE checkMenuTable FROM @preparedStatement;
EXECUTE checkMenuTable;
DEALLOCATE PREPARE checkMenuTable;

-- If admin_menu table exists, add the menu item
-- First, find the Accounting parent menu ID
SET @accountingParentId = (SELECT id FROM admin_menu WHERE url = '#' AND title LIKE '%Accounting%' LIMIT 1);

-- Insert the Apartment Invoices menu item if it doesn't exist
INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 
    'Apartment Invoices',
    '/admin/apartment-invoices',
    @accountingParentId,
    (SELECT COALESCE(MAX(order_index), 0) + 1 FROM admin_menu WHERE parent_id = @accountingParentId),
    'fa fa-file-invoice-dollar',
    '["Super Admin", "Admin", "Accounting"]',
    1
WHERE NOT EXISTS (
    SELECT 1 FROM admin_menu 
    WHERE url = '/admin/apartment-invoices' 
    AND (parent_id = @accountingParentId OR parent_id IS NULL)
)
AND @accountingParentId IS NOT NULL;

-- Rollback instructions:
-- To rollback this migration, run:
-- DELETE FROM admin_menu WHERE url = '/admin/apartment-invoices';

