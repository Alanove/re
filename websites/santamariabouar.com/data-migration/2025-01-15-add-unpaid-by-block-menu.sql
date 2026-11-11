-- Add "Unpaid by Block" menu item to the accounting section
-- This migration adds a new menu item for the unpaid report functionality

INSERT INTO `admin_menu` (
    `title`, 
    `url`, 
    `parent_id`, 
    `order_index`, 
    `icon`, 
    `roles`, 
    `is_visible`, 
    `created_at`, 
    `updated_at`
) VALUES (
    'Unpaid by Block',
    '/admin/common-expenses/unpaid-report',
    7, -- parent_id for Accounting section
    5, -- order_index (after Common Expenses which is 4)
    'fa fa-print',
    '[]',
    1,
    NOW(),
    NOW()
);
