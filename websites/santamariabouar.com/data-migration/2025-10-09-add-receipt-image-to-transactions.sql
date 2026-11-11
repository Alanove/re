-- Migration: Add receipt_image column to transactions table
-- Date: 2025-10-09
-- Description: Adds an optional receipt_image field to store uploaded receipt images

-- Add receipt_image column to transactions table (if not exists)
SET @dbname = DATABASE();
SET @tablename = 'transactions';
SET @columnname = 'receipt_image';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE transactions ADD COLUMN receipt_image VARCHAR(500) NULL AFTER receipt_generated'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add an index for better query performance (if not exists)
SET @indexname = 'idx_receipt_image';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  'CREATE INDEX idx_receipt_image ON transactions(receipt_image)'
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Rollback instructions:
-- To rollback this migration, run:
-- ALTER TABLE transactions DROP COLUMN receipt_image;
-- DROP INDEX idx_receipt_image ON transactions;

