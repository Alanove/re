-- Apartment Images Table
-- Stores apartment image references

CREATE TABLE IF NOT EXISTS apartment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    image_filename VARCHAR(255) NOT NULL,
    is_official BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    INDEX idx_apartment (apartment_id),
    INDEX idx_official (apartment_id, is_official)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

