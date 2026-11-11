-- Migration: Create migrations tracking table
-- Date: 2025-01-15
-- Description: Creates a table to track executed migrations

CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(100) DEFAULT 'system',
    status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_migration_name (migration_name),
    INDEX idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback instructions:
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS migrations;
