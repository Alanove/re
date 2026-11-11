-- Santa Maria Bouar CMS Database Schema
-- MySQL

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS invoice_transactions;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS apartment_gate_access;
DROP TABLE IF EXISTS apartment_owner_history;
DROP TABLE IF EXISTS apartment_payments_backup;
DROP TABLE IF EXISTS common_expenses_settings;
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
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    salt VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) NULL UNIQUE,
    phone VARCHAR(50) NULL,
    status VARCHAR(50) DEFAULT 'Active',
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    wallet_enabled TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login DATETIME NULL
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
    invoice_id INT NULL,
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
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_account (account_id),
    INDEX idx_category (category_id),
    INDEX idx_apartment (apartment_id),
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_created_by (created_by),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartments Table
CREATE TABLE apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT,
    renter_id INT,
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
    is_vacant TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT,
    listing_description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_apartment (floor, apartment_number),
    INDEX idx_owner (owner_id),
    INDEX idx_apartments_renter (renter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartment Users (many owners/tenants per apartment; one user can link to many apartments)
CREATE TABLE apartment_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'tenant') NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_apartment_user_role (apartment_id, user_id, role),
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_au_user (user_id),
    INDEX idx_au_apartment_role (apartment_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartment Gate Access (many users per apartment)
CREATE TABLE apartment_gate_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    user_id INT NOT NULL,
    relation VARCHAR(50) NOT NULL DEFAULT 'Other',
    expiry_date DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_apartment_user (apartment_id, user_id),
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_gate_access_apartment (apartment_id),
    INDEX idx_gate_access_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apartment Owner History (append-only ownership timeline)
CREATE TABLE apartment_owner_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    user_id INT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NULL,
    changed_by INT NULL,
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_owner_history_apartment (apartment_id),
    INDEX idx_owner_history_user (user_id),
    INDEX idx_owner_history_current (apartment_id, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Common Expenses Settings Table (formerly payments - stores price per meter settings)
CREATE TABLE common_expenses_settings (
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

-- Invoices Table (Unified invoice system for common expenses and utilities)
-- Status and amount_paid are computed from invoice_transactions
CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    description TEXT,
    due_date DATE,
    invoice_date DATE NOT NULL,
    year INT NULL,
    notes TEXT,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_apartment (apartment_id),
    INDEX idx_category (category_id),
    INDEX idx_due_date (due_date),
    INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice Transactions Junction Table
-- Links transactions to invoices and tracks payment allocations
-- invoice_id = NULL represents unallocated credits for the apartment
CREATE TABLE invoice_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NULL,  -- NULL for credits
    transaction_id INT NULL,  -- NULL for credits migrated from old system
    apartment_id INT NOT NULL,  -- Required for credits, also stored for invoice allocations
    amount DECIMAL(18,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    INDEX idx_invoice (invoice_id),
    INDEX idx_transaction (transaction_id),
    INDEX idx_apartment (apartment_id)
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
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    content TEXT,
    background_image VARCHAR(500) NULL,
    seo_image VARCHAR(500) NULL,
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

-- Apartment Images Table
CREATE TABLE apartment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    image_filename VARCHAR(255) NOT NULL,
    is_official BOOLEAN DEFAULT FALSE,
    status ENUM('approved', 'pending') NOT NULL DEFAULT 'approved',
    uploaded_by INT NULL,
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_apartment (apartment_id),
    INDEX idx_official (apartment_id, is_official)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Access Requests (temporary; deleted after approve/reject)
CREATE TABLE access_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_access_requests_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE access_request_apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    apartment_id INT NOT NULL,
    role ENUM('owner', 'tenant') NOT NULL DEFAULT 'owner',
    FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    UNIQUE KEY uq_request_apartment (request_id, apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Listing Requests
CREATE TABLE listing_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    user_id INT NOT NULL,
    request_type ENUM('for_sale', 'for_rent') NOT NULL,
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
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_listing_req_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Published apartment listing details (separate from core apartment record)
CREATE TABLE apartment_listings (
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
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compound-wide amenities shown on listing pages
CREATE TABLE compound_amenities (
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

-- Gate Access Requests
CREATE TABLE gate_access_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    user_id INT NOT NULL,
    action ENUM('add', 'remove') NOT NULL,
    target_user_id INT NULL,
    target_name VARCHAR(255) NULL,
    target_phone VARCHAR(50) NULL,
    target_email VARCHAR(255) NULL,
    relation VARCHAR(50) NULL,
    expiry_date DATE NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_gate_req_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
