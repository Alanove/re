-- Member portal schema: Google auth, pending photos, access/listing/gate requests
-- Run via: npm run migrate
-- Rollback notes at bottom

-- 1. Google OAuth id on users
ALTER TABLE users
  ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email;

-- 2. Pending member photo uploads
ALTER TABLE apartment_images
  ADD COLUMN status ENUM('approved', 'pending') NOT NULL DEFAULT 'approved' AFTER is_official,
  ADD COLUMN uploaded_by INT NULL AFTER status;

ALTER TABLE apartment_images
  ADD CONSTRAINT fk_apartment_images_uploaded_by
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Temporary access requests (deleted after approve/reject)
CREATE TABLE IF NOT EXISTS access_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_access_requests_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS access_request_apartments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  apartment_id INT NOT NULL,
  CONSTRAINT fk_ara_request FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ara_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_request_apartment (request_id, apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Listing requests (for_sale / for_rent) — status does not change until approved
CREATE TABLE IF NOT EXISTS listing_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  apartment_id INT NOT NULL,
  user_id INT NOT NULL,
  request_type ENUM('for_sale', 'for_rent') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_listing_req_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  CONSTRAINT fk_listing_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_listing_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_listing_req_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Gate access change requests
CREATE TABLE IF NOT EXISTS gate_access_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  apartment_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('add', 'remove') NOT NULL,
  target_user_id INT NULL,
  target_name VARCHAR(255) NULL,
  target_phone VARCHAR(50) NULL,
  relation VARCHAR(50) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_gate_req_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  CONSTRAINT fk_gate_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gate_req_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gate_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_gate_req_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback (manual):
-- DROP TABLE IF EXISTS gate_access_requests;
-- DROP TABLE IF EXISTS listing_requests;
-- DROP TABLE IF EXISTS access_request_apartments;
-- DROP TABLE IF EXISTS access_requests;
-- ALTER TABLE apartment_images DROP FOREIGN KEY fk_apartment_images_uploaded_by;
-- ALTER TABLE apartment_images DROP COLUMN uploaded_by, DROP COLUMN status;
-- ALTER TABLE users DROP COLUMN google_id;
