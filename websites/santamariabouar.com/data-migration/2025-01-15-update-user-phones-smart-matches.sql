-- Update phone numbers for high-confidence smart matches from CSV contacts
-- Migration: 2025-01-15-update-user-phones-smart-matches.sql
-- 
-- This script updates phone numbers for 3 users that have high-confidence smart matches
-- between the CSV contacts and existing users in the database.

-- High-confidence smart matches (reviewed and confirmed):
-- 1. Marie Najjar Mitri → Marie Al Najjar Mitri (ID: 44) - 100% match
-- 2. Carla Jerdi → CARLA JIRDI (ID: 95) - Very high confidence  
-- 3. Charbel Roukoz → Charbel & Mia Roukoz (ID: 34) - Very high confidence

-- Update phone numbers for smart matches
UPDATE users SET phone = '+961 70 907 718' WHERE id = 44; -- Marie Al Najjar Mitri (Marie Najjar Mitri)
UPDATE users SET phone = '+961 70 602 053' WHERE id = 95; -- CARLA JIRDI (Carla Jerdi)
UPDATE users SET phone = '+961 3 732 436' WHERE id = 34; -- Charbel & Mia Roukoz (Charbel Roukoz)

-- Verify the updates
SELECT id, username, phone FROM users WHERE id IN (44, 95, 34) ORDER BY id;
