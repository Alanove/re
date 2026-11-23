/**
 * E-commerce Database Schema Migration
 * 
 * Creates all tables required for the e-commerce platform:
 * - Products, Categories, Variants, Images, Reviews
 * - Shopping Cart, Orders, Order Items
 * - Discounts, Shipping, Payments
 * - Customer accounts and addresses
 * - Wishlists
 * 
 * Rollback: Drop all tables in reverse order of dependencies
 */

// Load environment variables from .env file (must be before database import)
import dotenv from 'dotenv';
import * as path from 'path';

// Determine environment (default to development)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

// Try to load environment-specific file, fallback to .env if not found
dotenv.config({ path: envPath });
// Also load base .env if it exists (for overrides)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import * as mysql from 'mysql2/promise';

interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

class EcommerceSchemaMigration {
  private connection: mysql.PoolConnection | null = null;

  async up(): Promise<MigrationResult> {
    try {
      this.connection = await db.getConnection();
      
      console.log('🚀 Starting E-commerce Schema Migration...\n');

      // Create tables in dependency order
      await this.createProductCategoriesTable();
      await this.createSizeChartsTable();
      await this.createProductsTable();
      await this.createProductVariantsTable();
      await this.createProductImagesTable();
      await this.createProductReviewsTable();
      await this.createCustomerAddressesTable();
      await this.createWishlistsTable();
      await this.createShoppingCartsTable();
      await this.createCartItemsTable();
      await this.createOrdersTable();
      await this.createOrderItemsTable();
      await this.createOrderStatusHistoryTable();
      await this.createDiscountsTable();
      await this.createDiscountUsageTable();
      await this.createShippingZonesTable();
      await this.createShippingRatesTable();
      await this.createPaymentMethodsTable();
      await this.createTransactionsTable();
      await this.createUserOAuthTable();
      await this.createVariantTypesTable();
      await this.createVariantTypeValuesTable();
      await this.addHasImageToVariants();

      console.log('\n✅ E-commerce schema migration completed successfully!\n');

      return {
        success: true,
        message: 'E-commerce schema created successfully'
      };
    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        message: 'Migration failed',
        error: error.message
      };
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      this.connection = await db.getConnection();
      
      console.log('🔄 Rolling back E-commerce Schema Migration...\n');

      // Drop tables in reverse order of dependencies
      const dropQueries = [
        'DROP TABLE IF EXISTS user_oauth',
        'DROP TABLE IF EXISTS transactions',
        'DROP TABLE IF EXISTS payment_methods',
        'DROP TABLE IF EXISTS shipping_rates',
        'DROP TABLE IF EXISTS shipping_zones',
        'DROP TABLE IF EXISTS discount_usage',
        'DROP TABLE IF EXISTS discounts',
        'DROP TABLE IF EXISTS order_status_history',
        'DROP TABLE IF EXISTS order_items',
        'DROP TABLE IF EXISTS orders',
        'DROP TABLE IF EXISTS cart_items',
        'DROP TABLE IF EXISTS shopping_carts',
        'DROP TABLE IF EXISTS wishlists',
        'DROP TABLE IF EXISTS customer_addresses',
        'DROP TABLE IF EXISTS product_reviews',
        'DROP TABLE IF EXISTS product_images',
        'DROP TABLE IF EXISTS product_variants',
        'DROP TABLE IF EXISTS products',
        'DROP TABLE IF EXISTS size_charts',
        'DROP TABLE IF EXISTS product_categories'
      ];

      for (const query of dropQueries) {
        await this.connection.query(query);
        console.log(`  ✓ Dropped: ${query.replace('DROP TABLE IF EXISTS ', '')}`);
      }

      console.log('\n✅ Rollback completed successfully!\n');

      return {
        success: true,
        message: 'E-commerce schema rolled back successfully'
      };
    } catch (error: any) {
      console.error('❌ Rollback failed:', error);
      return {
        success: false,
        message: 'Rollback failed',
        error: error.message
      };
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }

  private async createProductCategoriesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS product_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        parent_id INT NULL,
        image_url VARCHAR(500),
        is_featured BOOLEAN DEFAULT FALSE,
        order_index INT DEFAULT 0,
        meta_title VARCHAR(255),
        meta_description TEXT,
        meta_keywords VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL,
        INDEX idx_slug (slug),
        INDEX idx_parent (parent_id),
        INDEX idx_featured (is_featured),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: product_categories');
  }

  private async createSizeChartsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS size_charts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        chart_data TEXT NOT NULL COMMENT 'JSON data for size chart',
        product_id INT NULL,
        category_id INT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_category (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: size_charts');
  }

  private async createProductsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        slug VARCHAR(500) NOT NULL UNIQUE,
        sku VARCHAR(255) UNIQUE,
        short_description TEXT,
        description MEDIUMTEXT,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        compare_at_price DECIMAL(10,2) NULL,
        cost_price DECIMAL(10,2) NULL,
        weight DECIMAL(10,2) NULL,
        length DECIMAL(10,2) NULL,
        width DECIMAL(10,2) NULL,
        height DECIMAL(10,2) NULL,
        stock_quantity INT DEFAULT 0,
        low_stock_threshold INT DEFAULT 5,
        track_inventory BOOLEAN DEFAULT TRUE,
        is_featured BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        include_in_auto_ads BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'draft' COMMENT 'draft, published, archived',
        category_id INT NULL,
        size_chart_id INT NULL,
        meta_title VARCHAR(255),
        meta_description TEXT,
        meta_keywords VARCHAR(500),
        rating_average DECIMAL(3,2) DEFAULT 0,
        rating_count INT DEFAULT 0,
        view_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
        FOREIGN KEY (size_chart_id) REFERENCES size_charts(id) ON DELETE SET NULL,
        INDEX idx_slug (slug),
        INDEX idx_sku (sku),
        INDEX idx_category (category_id),
        INDEX idx_featured (is_featured),
        INDEX idx_active (is_active),
        INDEX idx_status (status),
        FULLTEXT idx_search (name, short_description, description)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: products');
  }

  private async createProductVariantsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        sku VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL COMMENT 'e.g., "Red - Large"',
        attributes TEXT NOT NULL COMMENT 'JSON: {"color": "red", "size": "large"}',
        price DECIMAL(10,2) NULL COMMENT 'Override product price if set',
        compare_at_price DECIMAL(10,2) NULL,
        stock_quantity INT DEFAULT 0,
        low_stock_threshold INT DEFAULT 5,
        track_inventory BOOLEAN DEFAULT TRUE,
        weight DECIMAL(10,2) NULL,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product (product_id),
        INDEX idx_sku (sku),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: product_variants');
  }

  private async createProductImagesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        variant_id INT NULL,
        image_url VARCHAR(500) NOT NULL,
        alt_text VARCHAR(255),
        order_index INT DEFAULT 0,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        INDEX idx_product (product_id),
        INDEX idx_variant (variant_id),
        INDEX idx_primary (is_primary)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: product_images');
  }

  private async createProductReviewsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        customer_id INT NULL COMMENT 'References users.id where role=customer',
        reviewer_name VARCHAR(255) NOT NULL,
        reviewer_email VARCHAR(255),
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        review_text TEXT,
        is_verified_purchase BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT FALSE,
        helpful_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_product (product_id),
        INDEX idx_customer (customer_id),
        INDEX idx_approved (is_approved),
        INDEX idx_rating (rating)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: product_reviews');
  }

  private async createCustomerAddressesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL COMMENT 'References users.id where role=customer',
        type VARCHAR(50) DEFAULT 'shipping' COMMENT 'shipping, billing',
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        address_line_1 VARCHAR(500) NOT NULL,
        address_line_2 VARCHAR(500),
        city VARCHAR(255) NOT NULL,
        state VARCHAR(255),
        postal_code VARCHAR(50),
        country VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        is_default BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_customer (customer_id),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: customer_addresses');
  }

  private async createWishlistsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS wishlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL COMMENT 'References users.id where role=customer',
        product_id INT NOT NULL,
        variant_id INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_wishlist (customer_id, product_id, variant_id),
        INDEX idx_customer (customer_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: wishlists');
  }

  private async createShoppingCartsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS shopping_carts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NULL COMMENT 'References users.id where role=customer, NULL for guest carts',
        session_id VARCHAR(255) NULL COMMENT 'For guest carts',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_customer (customer_id),
        INDEX idx_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: shopping_carts');
  }

  private async createCartItemsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cart_id INT NOT NULL,
        product_id INT NOT NULL,
        variant_id INT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL COMMENT 'Price at time of adding to cart',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        INDEX idx_cart (cart_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: cart_items');
  }

  private async createOrdersTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        customer_id INT NULL COMMENT 'References users.id where role=customer, NULL for guest orders',
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, processing, shipped, delivered, completed, cancelled, refunded',
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        shipping_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(50) NOT NULL COMMENT 'cash_on_delivery, credit_card, etc.',
        payment_status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, paid, failed, refunded',
        shipping_method VARCHAR(255),
        shipping_address TEXT NOT NULL COMMENT 'JSON address data',
        billing_address TEXT COMMENT 'JSON address data',
        discount_code VARCHAR(255),
        notes TEXT,
        internal_notes TEXT COMMENT 'Admin-only notes',
        shipped_at DATETIME NULL,
        delivered_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_number (order_number),
        INDEX idx_customer (customer_id),
        INDEX idx_status (status),
        INDEX idx_payment_status (payment_status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: orders');
  }

  private async createOrderItemsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        variant_id INT NULL,
        product_name VARCHAR(500) NOT NULL COMMENT 'Snapshot of product name at time of order',
        variant_name VARCHAR(255) COMMENT 'Snapshot of variant name',
        sku VARCHAR(255),
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
        INDEX idx_order (order_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: order_items');
  }

  private async createOrderStatusHistoryTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS order_status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT,
        created_by INT NULL COMMENT 'References users.id for admin who changed status',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order (order_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: order_status_history');
  }

  private async createDiscountsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS discounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL COMMENT 'percentage, fixed_amount',
        value DECIMAL(10,2) NOT NULL COMMENT 'Percentage (0-100) or fixed amount',
        minimum_purchase DECIMAL(10,2) NULL,
        maximum_discount DECIMAL(10,2) NULL COMMENT 'For percentage discounts',
        usage_limit INT NULL COMMENT 'Total times code can be used',
        usage_limit_per_customer INT NULL COMMENT 'Times per customer',
        used_count INT DEFAULT 0,
        start_date DATETIME NULL,
        end_date DATETIME NULL,
        is_active BOOLEAN DEFAULT TRUE,
        applies_to VARCHAR(50) DEFAULT 'all' COMMENT 'all, products, categories',
        product_ids TEXT NULL COMMENT 'JSON array of product IDs',
        category_ids TEXT NULL COMMENT 'JSON array of category IDs',
        first_time_customer_only BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_active (is_active),
        INDEX idx_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: discounts');
  }

  private async createDiscountUsageTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS discount_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discount_id INT NOT NULL,
        order_id INT NOT NULL,
        customer_id INT NULL COMMENT 'References users.id where role=customer',
        discount_amount DECIMAL(10,2) NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_discount (discount_id),
        INDEX idx_order (order_id),
        INDEX idx_customer (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: discount_usage');
  }

  private async createShippingZonesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS shipping_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        countries TEXT NOT NULL COMMENT 'JSON array of country codes',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: shipping_zones');
  }

  private async createShippingRatesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS shipping_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        zone_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        method VARCHAR(100) NOT NULL COMMENT 'flat_rate, weight_based, price_based',
        base_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
        per_item_rate DECIMAL(10,2) DEFAULT 0,
        per_weight_rate DECIMAL(10,2) DEFAULT 0 COMMENT 'Per kg or unit',
        free_shipping_threshold DECIMAL(10,2) NULL,
        min_order_amount DECIMAL(10,2) NULL,
        max_order_amount DECIMAL(10,2) NULL,
        estimated_days INT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        order_index INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE CASCADE,
        INDEX idx_zone (zone_id),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: shipping_rates');
  }

  private async createPaymentMethodsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE COMMENT 'cash_on_delivery, netcommerce, etc.',
        type VARCHAR(50) NOT NULL COMMENT 'gateway, manual',
        description TEXT,
        config TEXT COMMENT 'JSON configuration for gateway settings',
        is_active BOOLEAN DEFAULT TRUE,
        order_index INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: payment_methods');
  }

  private async createTransactionsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_method_id INT NOT NULL,
        transaction_id VARCHAR(255) UNIQUE COMMENT 'Gateway transaction ID',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded',
        gateway_response TEXT COMMENT 'JSON response from payment gateway',
        failure_reason TEXT,
        processed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
        INDEX idx_order (order_id),
        INDEX idx_transaction_id (transaction_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: transactions');
  }

  private async createUserOAuthTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS user_oauth (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        provider VARCHAR(50) NOT NULL COMMENT 'google, microsoft, facebook',
        provider_id VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        name VARCHAR(255),
        picture VARCHAR(500),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_provider_user (provider, provider_id),
        INDEX idx_user (user_id),
        INDEX idx_provider (provider)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: user_oauth');
  }

  private async createVariantTypesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS variant_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE COMMENT 'e.g., Size, Color, Material',
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        has_image BOOLEAN DEFAULT FALSE COMMENT 'Whether variants of this type can have images (e.g., colors)',
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_active (is_active),
        INDEX idx_display_order (display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: variant_types');
  }

  private async createVariantTypeValuesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS variant_type_values (
        id INT AUTO_INCREMENT PRIMARY KEY,
        variant_type_id INT NOT NULL,
        value VARCHAR(255) NOT NULL COMMENT 'e.g., Small, Red, Cotton',
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE,
        UNIQUE KEY unique_type_value (variant_type_id, value),
        INDEX idx_variant_type (variant_type_id),
        INDEX idx_active (is_active),
        INDEX idx_display_order (display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.connection!.query(query);
    console.log('  ✓ Created: variant_type_values');
  }

  private async addHasImageToVariants(): Promise<void> {
    try {
      await this.connection!.query(`
        ALTER TABLE product_variants 
        ADD COLUMN has_image BOOLEAN DEFAULT FALSE COMMENT 'Whether this variant should have an image'
      `);
      console.log('  ✓ Updated: product_variants (added has_image flag)');
    } catch (error: any) {
      // Column might already exist, ignore error
      if (!error.message.includes('Duplicate column name')) {
        console.log('  ⚠️  Could not add has_image to product_variants (may already exist)');
      }
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new EcommerceSchemaMigration();
  const command = process.argv[2];

  if (command === 'down') {
    migration.down()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  } else {
    migration.up()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  }
}

export default EcommerceSchemaMigration;

