-- Rich apartment listings and compound-wide amenities
-- Run via: npm run migrate

-- 1. Published listing details (one row per apartment when listed)
CREATE TABLE IF NOT EXISTS apartment_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  apartment_id INT NOT NULL,
  listing_type ENUM('for_sale', 'for_rent') NOT NULL,
  description TEXT NULL,
  price_usd DECIMAL(12,2) NULL,
  price_negotiable TINYINT(1) NOT NULL DEFAULT 0,
  contact_for_price TINYINT(1) NOT NULL DEFAULT 0,
  is_furnished TINYINT(1) NOT NULL DEFAULT 0,
  parking_spaces INT NOT NULL DEFAULT 0,
  bedrooms INT NOT NULL DEFAULT 0,
  bathrooms DECIMAL(3,1) NOT NULL DEFAULT 0,
  has_garden TINYINT(1) NOT NULL DEFAULT 0,
  has_terrace TINYINT(1) NOT NULL DEFAULT 0,
  has_balcony TINYINT(1) NOT NULL DEFAULT 0,
  has_storage_room TINYINT(1) NOT NULL DEFAULT 0,
  availability_date DATE NULL,
  pet_friendly TINYINT(1) NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_apartment_listing (apartment_id),
  CONSTRAINT fk_al_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  CONSTRAINT fk_al_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Extend listing_requests with full submission snapshot
ALTER TABLE listing_requests
  ADD COLUMN price_usd DECIMAL(12,2) NULL AFTER description,
  ADD COLUMN price_negotiable TINYINT(1) NOT NULL DEFAULT 0 AFTER price_usd,
  ADD COLUMN contact_for_price TINYINT(1) NOT NULL DEFAULT 0 AFTER price_negotiable,
  ADD COLUMN is_furnished TINYINT(1) NOT NULL DEFAULT 0 AFTER contact_for_price,
  ADD COLUMN parking_spaces INT NOT NULL DEFAULT 0 AFTER is_furnished,
  ADD COLUMN bedrooms INT NOT NULL DEFAULT 0 AFTER parking_spaces,
  ADD COLUMN bathrooms DECIMAL(3,1) NOT NULL DEFAULT 0 AFTER bedrooms,
  ADD COLUMN has_garden TINYINT(1) NOT NULL DEFAULT 0 AFTER bathrooms,
  ADD COLUMN has_terrace TINYINT(1) NOT NULL DEFAULT 0 AFTER has_garden,
  ADD COLUMN has_balcony TINYINT(1) NOT NULL DEFAULT 0 AFTER has_terrace,
  ADD COLUMN has_storage_room TINYINT(1) NOT NULL DEFAULT 0 AFTER has_balcony,
  ADD COLUMN availability_date DATE NULL AFTER has_storage_room,
  ADD COLUMN pet_friendly TINYINT(1) NULL AFTER availability_date;

-- 3. Compound-wide amenities (admin-managed, shown on all listing pages)
CREATE TABLE IF NOT EXISTS compound_amenities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(100) NOT NULL DEFAULT 'bi-star',
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_compound_amenities_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed compound amenities from Facilities page content
INSERT INTO compound_amenities (name, icon, description, sort_order, is_active)
SELECT * FROM (
  SELECT 'Swimming Pool' AS name, 'bi-water' AS icon, 'Beautiful swimming pool for relaxation and family fun.' AS description, 1 AS sort_order, 1 AS is_active
  UNION ALL SELECT 'Playground', 'bi-emoji-smile', 'Safe playground area for children.', 2, 1
  UNION ALL SELECT 'Green Areas', 'bi-tree', 'Landscaped gardens and open green spaces throughout the compound.', 3, 1
  UNION ALL SELECT '24/7 Security', 'bi-shield-check', 'Round-the-clock security for residents peace of mind.', 4, 1
  UNION ALL SELECT 'Generator', 'bi-lightning-charge', 'Backup power generator for uninterrupted electricity.', 5, 1
  UNION ALL SELECT 'Parking', 'bi-car-front', 'Dedicated parking areas for residents and guests.', 6, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM compound_amenities LIMIT 1);

-- 5. Backfill apartment_listings from existing for_rent / for_sale apartments
INSERT INTO apartment_listings (apartment_id, listing_type, description, approved_at)
SELECT
  a.id,
  a.status,
  a.listing_description,
  a.updated_at
FROM apartments a
WHERE a.status IN ('for_rent', 'for_sale')
  AND NOT EXISTS (SELECT 1 FROM apartment_listings al WHERE al.apartment_id = a.id);

-- Rollback (manual):
-- DROP TABLE IF EXISTS compound_amenities;
-- DROP TABLE IF EXISTS apartment_listings;
-- ALTER TABLE listing_requests DROP COLUMN pet_friendly, DROP COLUMN availability_date,
--   DROP COLUMN has_storage_room, DROP COLUMN has_balcony, DROP COLUMN has_terrace,
--   DROP COLUMN has_garden, DROP COLUMN bathrooms, DROP COLUMN bedrooms,
--   DROP COLUMN parking_spaces, DROP COLUMN is_furnished, DROP COLUMN contact_for_price,
--   DROP COLUMN price_negotiable, DROP COLUMN price_usd;
