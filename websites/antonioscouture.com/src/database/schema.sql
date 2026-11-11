-- Database Schema
-- MySQL (CMS core only; e-commerce tables come from data-migration)

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS theme_config;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS slider;
DROP TABLE IF EXISTS admin_menu;
DROP TABLE IF EXISTS menu;
DROP TABLE IF EXISTS page_tag_relationships;
DROP TABLE IF EXISTS page_tags;
DROP TABLE IF EXISTS page_photos;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS chat_conversation_reads;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_conversations;
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
    publish_date DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES pages(id),
    INDEX idx_slug (slug),
    INDEX idx_status (status),
    INDEX idx_pages_publish_date (publish_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Page tags (admin + news filtering)
CREATE TABLE page_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_page_tags_slug (slug),
    INDEX idx_page_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE page_tag_relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    page_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_page_tag (page_id, tag_id),
    INDEX idx_ptr_page_id (page_id),
    INDEX idx_ptr_tag_id (tag_id),
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES page_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Page gallery (bottom of page.ejs / news)
CREATE TABLE page_photos (
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
    media_type VARCHAR(20) NOT NULL DEFAULT 'image',
    video_url VARCHAR(500) NULL,
    poster_image VARCHAR(500) NULL,
    video_url_mobile VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Site Settings Table
CREATE TABLE site_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'text',     
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

-- Live chat (visitor + staff)
CREATE TABLE chat_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_key CHAR(36) NOT NULL,
    visitor_first_name VARCHAR(255) NULL,
    visitor_email VARCHAR(255) NULL,
    visitor_phone VARCHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_message_at DATETIME NULL,
    UNIQUE KEY uq_chat_public_key (public_key),
    INDEX idx_chat_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender ENUM('visitor', 'staff') NOT NULL,
    staff_user_id INT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_chat_messages_conv (conversation_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_conversation_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_user_id INT NOT NULL,
    conversation_id INT NOT NULL,
    last_read_message_id INT NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chat_read_staff_conv (staff_user_id, conversation_id),
    FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    INDEX idx_chat_read_staff (staff_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
