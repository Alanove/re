-- Database Schema
-- MySQL

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS apartment_payments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS apartments;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS transaction_categories;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS theme_config;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS slider;
DROP TABLE IF EXISTS admin_menu;
DROP TABLE IF EXISTS menu;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255),
    salt VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'Active',
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounts Table
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    balance DECIMAL(18,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'XAF',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transaction Categories Table
CREATE TABLE transaction_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'income' or 'expense'
    description TEXT,
    color VARCHAR(50),
    icon VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions Table
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    category_id INT NOT NULL,
    apartment_id INT NULL,
    amount DECIMAL(18,2) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'income' or 'expense'
    date DATE NOT NULL,
    description TEXT,
    reference VARCHAR(255),
    notes TEXT,
    created_by INT NULL DEFAULT 1,
    receipt_generated TINYINT(1) DEFAULT 0,
    receipt_image VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id),
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_account (account_id),
    INDEX idx_category (category_id),
    INDEX idx_apartment (apartment_id),
    INDEX idx_created_by (created_by),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartments Table
CREATE TABLE apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT,
    apartment_number VARCHAR(50) NOT NULL,
    apartment_number_unofficial VARCHAR(50),
    owner_name VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(50),
    owner_email VARCHAR(255),
    floor VARCHAR(50),
    size DECIMAL(10,2),
    bedrooms INT,
    bathrooms INT,
    registration_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_apartment (floor, apartment_number),
    INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments Table (Master Payment Records)
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(18,2) NOT NULL,
    year INT NOT NULL,
    due_date DATE,
    payment_type VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartment Payments Table (Individual Apartment Payment Records)
CREATE TABLE apartment_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    payment_id INT NOT NULL,
    amount_due DECIMAL(18,2) NOT NULL,
    amount_paid DECIMAL(18,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
    payment_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    INDEX idx_apartment (apartment_id),
    INDEX idx_payment (payment_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Projects Table
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    content TEXT,
    country VARCHAR(255),
    city VARCHAR(255),
    year INT,
    category VARCHAR(255),
    client VARCHAR(255),
    featured_image VARCHAR(500),
    images TEXT, -- JSON array of image paths
    tags TEXT, -- JSON array of tags
    status VARCHAR(50) DEFAULT 'published',
    order_index INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pages Table
CREATE TABLE pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(1000) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    content MEDIUMTEXT,
    meta_description VARCHAR(500),
    meta_keywords VARCHAR(500),
    status VARCHAR(50) DEFAULT 'published',
    template VARCHAR(100),
    parent_id INT NULL,
    order_index INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES pages(id),
    INDEX idx_slug (slug),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu Table
CREATE TABLE menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    parent_id INT NULL,
    order_index INT DEFAULT 0,
    target VARCHAR(50) DEFAULT '_self',
    css_class VARCHAR(255),
    icon VARCHAR(100),
    is_visible BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES menu(id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin Menu Table
CREATE TABLE admin_menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    parent_id INT NULL,
    order_index INT DEFAULT 0,
    icon VARCHAR(100),
    roles TEXT, -- JSON array of allowed roles
    is_visible BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES admin_menu(id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Slider Table
CREATE TABLE slider (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500),
    subtitle VARCHAR(500),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    link_text VARCHAR(255),
    order_index INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    duration_seconds INT NOT NULL DEFAULT 5,
    mobile_image_url VARCHAR(500) NULL,
    mobile_video_url VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Site Settings Table
CREATE TABLE site_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'text', -- 'text', 'number', 'boolean', 'json'
    description VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Theme Configuration Table
CREATE TABLE theme_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_key VARCHAR(255) NOT NULL UNIQUE,
    theme_value TEXT,
    description VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
