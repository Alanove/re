-- Add apartment_id column to transactions table
-- This allows transactions to be linked to specific apartments (e.g., for common expenses)

ALTER TABLE transactions 
ADD COLUMN apartment_id INT NULL AFTER category_id,
ADD FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL,
ADD INDEX idx_apartment (apartment_id);

