-- Add phone number column to users table
-- Migration: 2025-01-15-add-phone-to-users.sql

-- Add phone column to users table
ALTER TABLE users 
ADD COLUMN phone VARCHAR(50) NULL 
AFTER email;

-- Add index for phone number searches
CREATE INDEX idx_users_phone ON users(phone);

-- Update existing users with phone numbers if available
-- This is optional and can be customized based on existing data
-- UPDATE users SET phone = 'default-phone' WHERE phone IS NULL;
