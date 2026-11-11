-- Add created_by and receipt_generated columns to transactions table

ALTER TABLE transactions 
ADD COLUMN created_by INT NULL DEFAULT 1 AFTER notes,
ADD COLUMN receipt_generated TINYINT(1) DEFAULT 0 AFTER created_by,
ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD INDEX idx_created_by (created_by);

