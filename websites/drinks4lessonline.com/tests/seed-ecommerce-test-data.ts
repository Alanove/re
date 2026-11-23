import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (same as app.ts)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

/**
 * Seed test data for e-commerce functionality
 * Creates categories, products, variants, and images
 */

class EcommerceSeedData {
  private connection: mysql.PoolConnection | null = null;

  async connect(): Promise<void> {
    const pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    this.connection = await pool.getConnection();
    console.log('✓ Connected to database');
  }

  async seed(): Promise<void> {
    try {
      console.log('\n🌱 Seeding e-commerce test data...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Create variant types (attributes)
      await this.createVariantTypes();

      // Create categories
      await this.createCategories();

      // Create products with variants
      await this.createProducts();

      console.log('\n✅ Seed data created successfully!\n');
    } catch (error: any) {
      console.error('❌ Seeding failed:', error);
      throw error;
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }

  private async createVariantTypes(): Promise<void> {
    console.log('Creating variant types (attributes)...');

    // Color attribute
    const [colorResult] = await this.connection!.query<any>(
      `INSERT INTO variant_types (name, slug, description, has_image, display_order, is_active)
       VALUES ('Color', 'color', 'Product color variations', TRUE, 1, TRUE)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    const colorId = colorResult.insertId;

    // Add color values
    const colors = [
      { value: 'Red', color_code: '#FF0000', order: 1 },
      { value: 'Blue', color_code: '#0000FF', order: 2 },
      { value: 'Green', color_code: '#008000', order: 3 },
      { value: 'Black', color_code: '#000000', order: 4 },
      { value: 'White', color_code: '#FFFFFF', order: 5 },
      { value: 'Yellow', color_code: '#FFFF00', order: 6 }
    ];

    for (const color of colors) {
      await this.connection!.query(
        `INSERT INTO variant_type_values (variant_type_id, value, color_code, display_order, is_active, is_preselected)
         VALUES (?, ?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE color_code = VALUES(color_code)`,
        [colorId, color.value, color.color_code, color.order, color.order === 1]
      );
    }

    // Size attribute
    const [sizeResult] = await this.connection!.query<any>(
      `INSERT INTO variant_types (name, slug, description, has_image, display_order, is_active)
       VALUES ('Size', 'size', 'Product size variations', FALSE, 2, TRUE)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    const sizeId = sizeResult.insertId;

    // Add size values
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    for (let i = 0; i < sizes.length; i++) {
      await this.connection!.query(
        `INSERT INTO variant_type_values (variant_type_id, value, display_order, is_active, is_preselected)
         VALUES (?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`,
        [sizeId, sizes[i], i + 1, i === 2] // M is preselected
      );
    }

    // Material attribute
    const [materialResult] = await this.connection!.query<any>(
      `INSERT INTO variant_types (name, slug, description, has_image, display_order, is_active)
       VALUES ('Material', 'material', 'Product material', FALSE, 3, TRUE)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    const materialId = materialResult.insertId;

    // Add material values
    const materials = ['Cotton', 'Polyester', 'Leather', 'Canvas', 'Nylon'];
    for (let i = 0; i < materials.length; i++) {
      await this.connection!.query(
        `INSERT INTO variant_type_values (variant_type_id, value, display_order, is_active, is_preselected)
         VALUES (?, ?, ?, TRUE, FALSE)
         ON DUPLICATE KEY UPDATE display_order = VALUES(display_order)`,
        [materialId, materials[i], i + 1]
      );
    }

    console.log('  ✓ Created variant types: Color, Size, Material');
  }

  private async createCategories(): Promise<void> {
    console.log('Creating product categories...');

    const categories = [
      {
        name: 'Sports Equipment',
        slug: 'sports-equipment',
        description: 'High-quality sports equipment for all your athletic needs',
        is_featured: true,
        order: 1
      },
      {
        name: 'Apparel',
        slug: 'apparel',
        description: 'Comfortable and stylish athletic wear',
        is_featured: true,
        order: 2
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Essential accessories to complete your gear',
        is_featured: true,
        order: 3
      },
      {
        name: 'Footwear',
        slug: 'footwear',
        description: 'Performance footwear for every sport',
        is_featured: false,
        order: 4
      }
    ];

    for (const category of categories) {
      await this.connection!.query(
        `INSERT INTO product_categories (name, slug, description, is_featured, order_index, is_active)
         VALUES (?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE slug=VALUES(slug)`,
        [category.name, category.slug, category.description, category.is_featured, category.order]
      );
    }

    console.log(`  ✓ Created ${categories.length} categories`);
  }

  private async createProducts(): Promise<void> {
    console.log('Creating products with variants...');

    // Get category IDs
    const [categories] = await this.connection!.query<any[]>(
      'SELECT id, slug FROM product_categories'
    );
    const catMap: any = {};
    categories.forEach(c => catMap[c.slug] = c.id);

      const products = [
      {
        name: 'Professional Soccer Ball',
        slug: 'professional-soccer-ball',
        category: 'sports-equipment',
        price: 39.99,
        compare_at_price: 49.99,
        description: '<p>Official size and weight soccer ball perfect for matches and training.</p>',
        short_description: 'Professional quality soccer ball',
        stock: 100,
        is_featured: true,
        variants: [
          { name: 'Red - Size 5', attributes: { Color: 'Red' }, price: 39.99, stock: 30 },
          { name: 'Blue - Size 5', attributes: { Color: 'Blue' }, price: 39.99, stock: 35 },
          { name: 'White - Size 5', attributes: { Color: 'White' }, price: 39.99, stock: 35 }
        ]
      },
      {
        name: 'Performance Running Shoes',
        slug: 'performance-running-shoes',
        category: 'footwear',
        price: 129.99,
        compare_at_price: null,
        description: '<p>Lightweight running shoes with superior cushioning and support.</p>',
        short_description: 'Comfortable running shoes for all distances',
        stock: 200,
        is_featured: true,
        variants: [
          { name: 'Black - Size 42', attributes: { Color: 'Black', Size: 'L' }, price: 129.99, stock: 25 },
          { name: 'White - Size 42', attributes: { Color: 'White', Size: 'L' }, price: 129.99, stock: 25 },
          { name: 'Blue - Size 42', attributes: { Color: 'Blue', Size: 'L' }, price: 129.99, stock: 20 }
        ]
      },
      {
        name: 'Athletic T-Shirt',
        slug: 'athletic-t-shirt',
        category: 'apparel',
        price: 24.99,
        compare_at_price: 29.99,
        description: '<p>Breathable athletic t-shirt made from moisture-wicking fabric.</p>',
        short_description: 'Comfortable athletic wear',
        stock: 300,
        is_featured: true,
        variants: [
          { name: 'Red - Small', attributes: { Color: 'Red', Size: 'S' }, price: 24.99, stock: 50 },
          { name: 'Red - Medium', attributes: { Color: 'Red', Size: 'M' }, price: 24.99, stock: 60 },
          { name: 'Red - Large', attributes: { Color: 'Red', Size: 'L' }, price: 24.99, stock: 50 },
          { name: 'Blue - Small', attributes: { Color: 'Blue', Size: 'S' }, price: 24.99, stock: 40 },
          { name: 'Blue - Medium', attributes: { Color: 'Blue', Size: 'M' }, price: 24.99, stock: 50 },
          { name: 'Blue - Large', attributes: { Color: 'Blue', Size: 'L' }, price: 24.99, stock: 50 }
        ]
      },
      {
        name: 'Training Backpack',
        slug: 'training-backpack',
        category: 'accessories',
        price: 59.99,
        compare_at_price: null,
        description: '<p>Spacious backpack with multiple compartments for all your gear.</p>',
        short_description: 'Durable training backpack',
        stock: 150,
        is_featured: false,
        variants: [
          { name: 'Black - Nylon', attributes: { Color: 'Black', Material: 'Nylon' }, price: 59.99, stock: 50 },
          { name: 'Blue - Nylon', attributes: { Color: 'Blue', Material: 'Nylon' }, price: 59.99, stock: 50 },
          { name: 'Black - Canvas', attributes: { Color: 'Black', Material: 'Canvas' }, price: 64.99, stock: 50 }
        ]
      },
      {
        name: 'Basketball',
        slug: 'basketball',
        category: 'sports-equipment',
        price: 44.99,
        compare_at_price: null,
        description: '<p>Official size basketball with excellent grip and durability.</p>',
        short_description: 'Professional basketball',
        stock: 80,
        is_featured: false,
        variants: []
      }
    ];

    for (const product of products) {
      const categoryId = catMap[product.category] || null;

      // Insert product
      const [productResult] = await this.connection!.query<any>(
        `INSERT INTO products (
          name, slug, description, short_description, category_id, price, compare_at_price,
          stock_quantity, is_featured, status, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', TRUE)
        ON DUPLICATE KEY UPDATE slug=VALUES(slug), id=LAST_INSERT_ID(id)`,
        [
          product.name,
          product.slug,
          product.description,
          product.short_description,
          categoryId,
          product.price,
          product.compare_at_price || null,
          product.stock,
          product.is_featured
        ]
      );
      const productId = productResult.insertId;

      // Insert variants if any
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          await this.connection!.query(
            `INSERT INTO product_variants (
              product_id, name, sku, attributes, price, stock_quantity, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
            [
              productId,
              variant.name,
              `${product.slug}-${variant.name.toLowerCase().replace(/\s+/g, '-')}`,
              JSON.stringify(variant.attributes),
              variant.price,
              variant.stock
            ]
          );
        }
        console.log(`  ✓ Created product: ${product.name} with ${product.variants.length} variants`);
      } else {
        console.log(`  ✓ Created product: ${product.name}`);
      }
    }

    console.log(`  ✓ Created ${products.length} products`);
  }
}

// Run seeding if called directly
if (require.main === module) {
  const seeder = new EcommerceSeedData();
  
  (async () => {
    try {
      await seeder.seed();
      process.exit(0);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

export default EcommerceSeedData;
