-- Migration: Create apartment_invoices table
-- Date: 2025-01-16
-- Description: Creates a table to store all apartment invoices (common expenses and utilities)

CREATE TABLE IF NOT EXISTS apartment_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    description TEXT,
    due_date DATE,
    invoice_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
    amount_paid DECIMAL(18,2) DEFAULT 0,
    invoice_type VARCHAR(50) DEFAULT 'other', -- 'common_expense', 'utility', 'other'
    payment_id INT NULL,
    year INT NULL,
    notes TEXT,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_apartment (apartment_id),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_invoice_type (invoice_type),
    INDEX idx_payment_id (payment_id),
    INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback instructions:
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS apartment_invoices;

