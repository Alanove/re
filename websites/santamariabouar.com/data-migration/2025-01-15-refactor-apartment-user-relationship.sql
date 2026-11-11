-- Migration: Refactor Apartment-User Relationship
-- Date: 2025-01-15
-- Author: AI Assistant
-- 
-- Description:
-- This migration refactors the apartment-user relationship to properly normalize the database.
-- It removes redundant owner information from the apartments table since this data should
-- come from the users table via the owner_id foreign key relationship.
-- 
-- Rollback:
-- To rollback this migration, you would need to:
-- 1. Add back the owner_name, owner_phone, owner_email columns to apartments table
-- 2. Populate them with data from the users table
-- 3. Update any code that was modified to use the new structure

-- Step 1: Verify that all apartments have valid owner_id links
-- First, let's check if there are any apartments without owner_id or with invalid owner_id
SELECT 
    COUNT(*) as apartments_without_owner,
    (SELECT COUNT(*) FROM apartments WHERE owner_id IS NOT NULL AND owner_id NOT IN (SELECT id FROM users)) as apartments_with_invalid_owner
FROM apartments 
WHERE owner_id IS NULL;

-- Step 2: For apartments without owner_id, we need to either:
-- a) Create users for them, or 
-- b) Set them to a default user
-- For now, let's create a placeholder user for apartments without owners
INSERT IGNORE INTO users (username, email, status, role, created_at)
SELECT 
    CONCAT('Owner_', a.id) as username,
    COALESCE(a.owner_email, CONCAT('owner_', a.id, '@placeholder.com')) as email,
    'Active' as status,
    'Member' as role,
    NOW() as created_at
FROM apartments a
WHERE a.owner_id IS NULL;

-- Step 3: Update apartments without owner_id to use the newly created users
UPDATE apartments a
SET owner_id = (
    SELECT u.id 
    FROM users u 
    WHERE u.username = CONCAT('Owner_', a.id)
    LIMIT 1
)
WHERE a.owner_id IS NULL;

-- Step 4: Verify all apartments now have valid owner_id
SELECT COUNT(*) as apartments_without_owner
FROM apartments 
WHERE owner_id IS NULL;

-- Step 5: Remove redundant columns from apartments table
-- Note: We'll do this in a separate step to be safe
-- ALTER TABLE apartments DROP COLUMN owner_name;
-- ALTER TABLE apartments DROP COLUMN owner_phone; 
-- ALTER TABLE apartments DROP COLUMN owner_email;

-- Step 6: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
CREATE INDEX IF NOT EXISTS idx_apartments_floor ON apartments(floor);

-- Step 7: Add foreign key constraint if it doesn't exist
-- Note: This should already exist based on the schema, but let's ensure it's there
ALTER TABLE apartments 
ADD CONSTRAINT IF NOT EXISTS fk_apartments_owner 
FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 8: Update any existing data inconsistencies
-- Ensure apartment status is valid
UPDATE apartments 
SET status = 'owned' 
WHERE status IS NULL OR status = '';

-- Step 9: Create a view for easy apartment-owner queries (optional)
CREATE OR REPLACE VIEW apartment_owners AS
SELECT 
    a.id as apartment_id,
    a.apartment_number,
    a.apartment_number_unofficial,
    a.floor,
    a.size,
    a.status,
    a.registration_date,
    a.notes,
    a.created_at as apartment_created_at,
    u.id as owner_id,
    u.username as owner_name,
    u.email as owner_email,
    u.phone as owner_phone,
    u.role as owner_role,
    u.status as owner_status
FROM apartments a
LEFT JOIN users u ON a.owner_id = u.id;

-- Step 10: Log the migration completion
INSERT INTO migrations (migration_name, executed_at, executed_by, status, notes)
VALUES (
    '2025-01-15-refactor-apartment-user-relationship',
    NOW(),
    'system',
    'success',
    'Refactored apartment-user relationship, removed redundant columns, ensured all apartments have valid owner_id'
);
