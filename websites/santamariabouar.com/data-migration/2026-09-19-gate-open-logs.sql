-- Gate open audit log + admin menu
-- Run via: npm run migrate
-- Rollback notes at bottom

CREATE TABLE IF NOT EXISTS gate_open_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NULL,
  user_phone VARCHAR(50) NULL,
  status ENUM('success', 'failed') NOT NULL,
  error_message VARCHAR(500) NULL,
  host VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  impersonator_id INT NULL,
  impersonator_name VARCHAR(255) NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_open_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gate_open_logs_impersonator FOREIGN KEY (impersonator_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_gate_open_logs_opened_at (opened_at),
  INDEX idx_gate_open_logs_user_id (user_id),
  INDEX idx_gate_open_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @gate_access_order := (
  SELECT order_index FROM admin_menu WHERE url = '/admin/main-gate-access' ORDER BY id DESC LIMIT 1
);

UPDATE admin_menu
SET order_index = order_index + 1, updated_at = NOW()
WHERE parent_id IS NULL
  AND @gate_access_order IS NOT NULL
  AND order_index > @gate_access_order;

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible, created_at, updated_at)
SELECT
  'Gate Open Log',
  '/admin/gate-open-log',
  NULL,
  IFNULL(@gate_access_order, 90) + 1,
  'fa fa-history',
  '["Super Admin","Admin"]',
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/gate-open-log');

-- Rollback (manual):
-- DELETE FROM admin_menu WHERE url = '/admin/gate-open-log';
-- DROP TABLE IF EXISTS gate_open_logs;
