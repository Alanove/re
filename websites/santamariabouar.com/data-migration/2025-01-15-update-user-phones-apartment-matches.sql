-- Update phone numbers for apartment-based matches from CSV contacts
-- Migration: 2025-01-15-update-user-phones-apartment-matches.sql
-- 
-- This script updates phone numbers for users that have apartment-based matches
-- between the CSV contacts and existing users in the database.

-- Apartment-based matches (reviewed and confirmed):
-- 1. Madeleine Kawwak → Madeleine Kawouk (ID: 22) - Apartment A104
-- 2. Abou Ayman → Madeleine Kawouk (ID: 22) - Apartment A104 (same apartment, different contact)

-- Note: Some matches need manual review as they may be incorrect:
-- - Elias Mitri (Father Of Nicolas) → Charles Fenianos (ID: 106) - Different people
-- - Lamis El Ghor → Charles Fenianos (ID: 106) - Different people

-- Update phone numbers for confirmed apartment matches
UPDATE users SET phone = '+46 70 971 83 00' WHERE id = 22; -- Madeleine Kawouk (Madeleine Kawwak)

-- Note: Abou Ayman and Madeleine Kawouk appear to be the same person (same apartment A104)
-- Only updating with one phone number to avoid conflicts

-- Verify the updates
SELECT id, username, phone FROM users WHERE id = 22;
