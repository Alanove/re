import * as mysql from 'mysql2/promise';
import { db } from '../src/config/database';

/**
 * Migration: Add variant types table for global variant definitions
 */
export async function migrateVariantTypes(connection: mysql.PoolConnection): Promise<void> {
  try {
    // Create variant_types table
    await connection.query(`
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
    `);
    console.log('  ✓ Created: variant_types');

    // Create variant_type_values table
    await connection.query(`
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
    `);
    console.log('  ✓ Created: variant_type_values');

    // Add has_image flag to product_variants table
    await connection.query(`
      ALTER TABLE product_variants 
      ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE COMMENT 'Whether this variant should have an image'
    `).catch(() => {
      // Column might already exist
    });
    console.log('  ✓ Updated: product_variants (added has_image flag)');

  } catch (error) {
    console.error('Error in variant types migration:', error);
    throw error;
  }
}

/**
 * Rollback: Remove variant types tables
 */
export async function rollbackVariantTypes(connection: mysql.PoolConnection): Promise<void> {
  try {
    await connection.query('DROP TABLE IF EXISTS variant_type_values');
    await connection.query('DROP TABLE IF EXISTS variant_types');
    await connection.query('ALTER TABLE product_variants DROP COLUMN IF EXISTS has_image');
    console.log('  ✓ Rolled back: variant_types and variant_type_values');
  } catch (error) {
    console.error('Error in variant types rollback:', error);
    throw error;
  }
}

export default async function run(): Promise<void> {
  const conn = await db.getConnection();
  try {
    await migrateVariantTypes(conn);
  } finally {
    conn.release();
  }
}
