-- CMS page gallery images (admin + page.ejs). Safe if table already exists.
CREATE TABLE IF NOT EXISTS page_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  thumb_url VARCHAR(512) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  INDEX idx_page_id (page_id),
  INDEX idx_page_display_order (page_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
