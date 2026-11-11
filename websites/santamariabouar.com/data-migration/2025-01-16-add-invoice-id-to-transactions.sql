-- Migration: Add invoice_id column to transactions table
-- Date: 2025-01-16
-- Description: Adds an optional invoice_id field to link payment transactions to invoices

-- Add invoice_id column to transactions table (if not exists)
SET @dbname = DATABASE();
SET @tablename = 'transactions';
SET @columnname = 'invoice_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE transactions ADD COLUMN invoice_id INT NULL AFTER apartment_id,
   ADD FOREIGN KEY (invoice_id) REFERENCES apartment_invoices(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add an index for better query performance (if not exists)
SET @indexname = 'idx_invoice_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  'CREATE INDEX idx_invoice_id ON transactions(invoice_id)'
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Rollback instructions:
-- To rollback this migration, run:
-- ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_invoice_id;
-- DROP INDEX idx_invoice_id ON transactions;
-- ALTER TABLE transactions DROP COLUMN invoice_id;

