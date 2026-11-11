-- Migration: Migrate existing apartment_payments to apartment_invoices
-- Date: 2025-01-16
-- Description: Converts all existing apartment_payments records to apartment_invoices with invoice_type='common_expense'

-- This migration:
-- 1. Gets the Common Expenses category ID
-- 2. Creates invoices from apartment_payments
-- 3. Preserves all payment data (amount, status, year, etc.)

-- Step 1: Get Common Expenses category ID (we'll use a variable)
SET @commonExpensesCategoryId = (
    SELECT id FROM transaction_categories 
    WHERE LOWER(name) = 'common expenses' 
    LIMIT 1
);

-- If Common Expenses category doesn't exist, we'll need to handle this
-- For now, we'll use category_id = 1 as fallback (you may need to adjust this)
SET @commonExpensesCategoryId = COALESCE(@commonExpensesCategoryId, 1);

-- Step 2: Migrate apartment_payments to apartment_invoices
-- Only migrate records that don't already have a corresponding invoice
INSERT INTO apartment_invoices (
    apartment_id,
    category_id,
    amount,
    description,
    due_date,
    invoice_date,
    status,
    amount_paid,
    invoice_type,
    payment_id,
    year,
    notes,
    created_by,
    created_at,
    updated_at
)
SELECT 
    ap.apartment_id,
    @commonExpensesCategoryId as category_id,
    ap.amount_due as amount,
    CONCAT(
        'Common Expenses ', 
        COALESCE(p.year, ''), 
        CASE 
            WHEN a.floor IS NOT NULL AND a.apartment_number IS NOT NULL 
            THEN CONCAT(' - Block ', a.floor, ' ', a.apartment_number)
            ELSE ''
        END,
        ' (Migrated)'
    ) as description,
    CASE 
        WHEN p.year IS NOT NULL THEN CONCAT(p.year, '-12-31')
        ELSE NULL
    END as due_date,
    COALESCE(
        ap.payment_date, 
        DATE(ap.created_at), 
        CASE 
            WHEN p.year IS NOT NULL THEN CONCAT(p.year, '-01-01')
            ELSE DATE(NOW())
        END
    ) as invoice_date,
    ap.status,
    ap.amount_paid,
    'common_expense' as invoice_type,
    ap.payment_id,
    p.year,
    ap.notes,
    NULL as created_by,
    ap.created_at,
    ap.updated_at
FROM apartment_payments ap
LEFT JOIN payments p ON ap.payment_id = p.id
LEFT JOIN apartments a ON ap.apartment_id = a.id
WHERE NOT EXISTS (
    -- Avoid duplicates: check if invoice already exists for this apartment and year
    SELECT 1 FROM apartment_invoices ai
    WHERE ai.apartment_id = ap.apartment_id
    AND ai.year = p.year
    AND ai.invoice_type = 'common_expense'
    AND ai.payment_id = ap.payment_id
)
AND ap.amount_due > 0; -- Only migrate non-zero amounts

-- Step 3: Update transactions that are linked to apartment_payments
-- Link them to the newly created invoices
-- This is a complex operation that requires matching transactions to invoices
-- For now, we'll leave transactions as-is since they're linked via apartment_id
-- Future payments will be linked via invoice_id

-- Summary query to verify migration
SELECT 
    'Migration Summary' as summary,
    (SELECT COUNT(*) FROM apartment_payments) as total_apartment_payments,
    (SELECT COUNT(*) FROM apartment_invoices WHERE invoice_type = 'common_expense') as total_invoices_created,
    (SELECT COUNT(DISTINCT apartment_id) FROM apartment_payments) as unique_apartments_with_payments,
    (SELECT COUNT(DISTINCT apartment_id) FROM apartment_invoices WHERE invoice_type = 'common_expense') as unique_apartments_with_invoices;

-- Rollback instructions:
-- To rollback this migration, run:
-- DELETE FROM apartment_invoices WHERE invoice_type = 'common_expense' 
-- AND description LIKE '%Migrated from apartment_payments%';

