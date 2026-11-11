-- Update phone numbers for exact matches from CSV contacts
-- Migration: 2025-01-15-update-user-phones-exact-matches.sql
-- 
-- This script updates phone numbers for 45 users that have exact matches
-- between the CSV contacts and existing users in the database.

-- First, ensure the phone column exists (run the add-phone migration if not done)
-- ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER email;
-- CREATE INDEX idx_users_phone ON users(phone);

-- Update phone numbers for exact matches
UPDATE users SET phone = '+965 9966 1362' WHERE id = 15; -- George (Aida & Georges Saleh)
UPDATE users SET phone = '+961 3 126 822' WHERE id = 41; -- Alfred Eid
UPDATE users SET phone = '+974 6609 8804' WHERE id = 17; -- Angela Melhem
UPDATE users SET phone = '+961 3 103 585' WHERE id = 76; -- Randa Nasr (Bakhos Husband Of Randa Nasr F304)
UPDATE users SET phone = '+961 3 822 923' WHERE id = 52; -- Bassam Moukarzel
UPDATE users SET phone = '+961 71 756 651' WHERE id = 93; -- Carlos Salloum
UPDATE users SET phone = '+1 (418) 933-1831' WHERE id = 32; -- Chadi Bou Abboud
UPDATE users SET phone = '+961 81 747 452' WHERE id = 64; -- Dany Ayoub (Dany Ayoubi)
UPDATE users SET phone = '+961 76 411 178' WHERE id = 28; -- Elie Abou Hamad
UPDATE users SET phone = '+961 3 136 123' WHERE id = 18; -- Elie Lahoud
UPDATE users SET phone = '+961 3 822 561' WHERE id = 29; -- Elie Mina
UPDATE users SET phone = '+973 3999 2297' WHERE id = 42; -- Fadi Omran
UPDATE users SET phone = '+961 3 250 160' WHERE id = 53; -- Fady Khoury
UPDATE users SET phone = '+961 3 056 763' WHERE id = 43; -- Geagea Geagea
UPDATE users SET phone = '+961 3 165 771 ::: +1 (954) 536-9217' WHERE id = 73; -- Gemayel Armale
UPDATE users SET phone = '+961 3 131 123' WHERE id = 15; -- George (George Lahoud) - Note: This will overwrite previous phone
UPDATE users SET phone = '+961 79 121 331' WHERE id = 15; -- George (Georges El Ghorr) - Note: This will overwrite previous phone
UPDATE users SET phone = '+961 70 658 887' WHERE id = 15; -- George (Georgette Ghreich) - Note: This will overwrite previous phone
UPDATE users SET phone = '+961 3 005 918' WHERE id = 31; -- Jad Hjeily
UPDATE users SET phone = '+961 3 931 516' WHERE id = 35; -- Joelle Salameh (Joelle Salame)
UPDATE users SET phone = '+961 3 384 007' WHERE id = 81; -- Karim Hitti
UPDATE users SET phone = '+961 3 613 743' WHERE id = 36; -- Maha Moussa
UPDATE users SET phone = '+961 3 565 946' WHERE id = 83; -- Mario Abou Jaoudeh (Mario Abou Jaoude)
UPDATE users SET phone = '+961 71 460 335' WHERE id = 45; -- May Moussa
UPDATE users SET phone = '+961 71 771 882' WHERE id = 38; -- Miled Nasr
UPDATE users SET phone = '+971 55 328 5622' WHERE id = 24; -- Mirna Samir Helou
UPDATE users SET phone = '+961 3 811 972' WHERE id = 85; -- Mostafa Itani
UPDATE users SET phone = '+961 3 049 335' WHERE id = 75; -- Nadim Khalil
UPDATE users SET phone = '+961 71 025 855' WHERE id = 86; -- Nadra Khoury
UPDATE users SET phone = '+961 3 296 401' WHERE id = 87; -- Pascale Chidiac
UPDATE users SET phone = '+971 50 687 1945' WHERE id = 104; -- Pascale Haddad
UPDATE users SET phone = '+961 3 499 534' WHERE id = 88; -- Paul Khadra
UPDATE users SET phone = '+961 3 118 740' WHERE id = 56; -- Raja Morkos
UPDATE users SET phone = '+961 3 748 727 ::: +1 (281) 743-8673' WHERE id = 98; -- Rami El Mir
UPDATE users SET phone = '+961 70 238 856 ::: +971 56 174 8708' WHERE id = 66; -- Randa Chidiac
UPDATE users SET phone = '+32 473 82 34 32' WHERE id = 68; -- Rita Najm (Rita Najm Belgika E302)
UPDATE users SET phone = '+961 70 348 561' WHERE id = 47; -- Roland Aziz
UPDATE users SET phone = '+961 71 952 459' WHERE id = 70; -- Sabine Kassouf
UPDATE users SET phone = '+961 3 959 749' WHERE id = 26; -- Salem Bitar
UPDATE users SET phone = '+33 6 44 79 50 93' WHERE id = 40; -- SAMER KHOURY (Samer Khoury)
UPDATE users SET phone = '+961 3 638 244' WHERE id = 61; -- Simon Karam
UPDATE users SET phone = '+971 55 596 1555' WHERE id = 49; -- Tony Beaino
UPDATE users SET phone = '+971 55 187 4543' WHERE id = 50; -- Walid Elias
UPDATE users SET phone = '+961 70 004 984' WHERE id = 90; -- Yaacoub Fares
UPDATE users SET phone = '+965 6565 8565' WHERE id = 91; -- Yamen Nissi

-- Note: User ID 15 (George) has multiple phone numbers in CSV. The last update will be the final phone number.
-- If you need to handle multiple phone numbers for George, consider updating the notes field or creating a separate phone numbers table.

-- Verify the updates
SELECT id, username, phone FROM users WHERE phone IS NOT NULL ORDER BY id;
