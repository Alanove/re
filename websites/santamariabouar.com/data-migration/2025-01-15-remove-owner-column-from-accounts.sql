-- Migration: Remove owner column from accounts table
-- Date: 2025-01-15
-- Description: Remove the owner/userId column from accounts table as it's no longer needed

-- Check if the column exists before attempting to drop it
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'accounts'
    AND COLUMN_NAME = 'type'
);

-- Drop the type column (which stores userId/owner) if it exists
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE accounts DROP COLUMN type', 
    'SELECT "Column type does not exist in accounts table" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the column has been removed
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'accounts'
ORDER BY ORDINAL_POSITION;
