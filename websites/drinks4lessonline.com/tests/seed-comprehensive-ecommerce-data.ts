import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';

/**
 * Comprehensive seed data for e-commerce
 * Creates 20 categories with 10-20 products each
 * Includes variants, images, brands, and realistic data
 */

class ComprehensiveEcommerceSeed {
  private connection: mysql.PoolConnection | null = null;
  private brandIds: number[] = [];
  private categoryIds: { [key: string]: number } = {};
  private variantTypeIds: { [key: string]: number } = {};

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
      console.log('\n🌱 Seeding comprehensive e-commerce data...\n');

      if (!this.connection) {
        await this.connect();
      }

      // Get brand IDs
      await this.loadBrandIds();

      // Get variant type IDs
      await this.loadVariantTypeIds();

      // Create categories
      await this.createCategories();

      // Create products with variants and images
      await this.createProducts();

      console.log('\n✅ Comprehensive seed data created successfully!\n');
    } catch (error: any) {
      console.error('❌ Seeding failed:', error);
      throw error;
    } finally {
      if (this.connection) {
        this.connection.release();
      }
    }
  }

  private async loadBrandIds(): Promise<void> {
    const [brands] = await this.connection!.query<any[]>('SELECT id FROM brands ORDER BY id');
    this.brandIds = brands.map(b => b.id);
    console.log(`✓ Loaded ${this.brandIds.length} brands`);
  }

  private async loadVariantTypeIds(): Promise<void> {
    const [types] = await this.connection!.query<any[]>('SELECT id, slug FROM variant_types');
    types.forEach((t: any) => {
      this.variantTypeIds[t.slug] = t.id;
    });
    console.log(`✓ Loaded ${types.length} variant types`);
  }

  private async createCategories(): Promise<void> {
    console.log('Creating 20 product categories...');

    const categories = [
      { name: 'Running Shoes', slug: 'running-shoes', description: 'Performance running shoes for all terrains', featured: true },
      { name: 'Training Shoes', slug: 'training-shoes', description: 'Versatile training and gym shoes', featured: true },
      { name: 'Basketball Shoes', slug: 'basketball-shoes', description: 'High-performance basketball footwear', featured: true },
      { name: 'Soccer Cleats', slug: 'soccer-cleats', description: 'Professional soccer cleats and boots', featured: true },
      { name: 'Athletic Apparel', slug: 'athletic-apparel', description: 'Performance athletic wear', featured: true },
      { name: 'T-Shirts', slug: 't-shirts', description: 'Comfortable athletic t-shirts', featured: false },
      { name: 'Shorts', slug: 'shorts', description: 'Training and running shorts', featured: false },
      { name: 'Hoodies & Sweatshirts', slug: 'hoodies-sweatshirts', description: 'Warm and comfortable hoodies', featured: false },
      { name: 'Pants & Joggers', slug: 'pants-joggers', description: 'Athletic pants and joggers', featured: false },
      { name: 'Sports Bags', slug: 'sports-bags', description: 'Backpacks and duffel bags', featured: true },
      { name: 'Footballs', slug: 'footballs', description: 'Soccer balls and footballs', featured: false },
      { name: 'Basketballs', slug: 'basketballs', description: 'Official size basketballs', featured: false },
      { name: 'Fitness Equipment', slug: 'fitness-equipment', description: 'Home fitness and gym equipment', featured: false },
      { name: 'Yoga & Pilates', slug: 'yoga-pilates', description: 'Yoga mats, blocks, and accessories', featured: false },
      { name: 'Running Accessories', slug: 'running-accessories', description: 'Running belts, armbands, and more', featured: false },
      { name: 'Socks', slug: 'socks', description: 'Athletic and sports socks', featured: false },
      { name: 'Caps & Hats', slug: 'caps-hats', description: 'Sports caps and hats', featured: false },
      { name: 'Gloves', slug: 'gloves', description: 'Training and sports gloves', featured: false },
      { name: 'Water Bottles', slug: 'water-bottles', description: 'Hydration bottles and accessories', featured: false },
      { name: 'Watches & Trackers', slug: 'watches-trackers', description: 'Fitness watches and activity trackers', featured: false }
    ];

    for (const category of categories) {
      const [result] = await this.connection!.query<any>(
        `INSERT INTO product_categories (name, slug, description, is_featured, is_active)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE slug=VALUES(slug), id=LAST_INSERT_ID(id)`,
        [category.name, category.slug, category.description, category.featured]
      );
      this.categoryIds[category.slug] = result.insertId;
    }

    console.log(`  ✓ Created ${categories.length} categories`);
  }

  private async createProducts(): Promise<void> {
    console.log('Creating products with variants and images...');

    const productTemplates = this.getProductTemplates();
    let totalProducts = 0;
    let totalVariants = 0;

    for (const template of productTemplates) {
      const categoryId = this.categoryIds[template.category];
      if (!categoryId) continue;

      for (let i = 0; i < template.count; i++) {
        const productName = template.names[i % template.names.length];
        const brandId = this.brandIds[Math.floor(Math.random() * this.brandIds.length)];
        
        const basePrice = template.priceRange[0] + Math.random() * (template.priceRange[1] - template.priceRange[0]);
        const hasDiscount = Math.random() > 0.6;
        const compareAtPrice = hasDiscount ? basePrice * 1.25 : null;

        // Insert product
        const [productResult] = await this.connection!.query<any>(
          `INSERT INTO products (
            name, slug, description, short_description, category_id, brand_id,
            price, compare_at_price, weight, length, width, height,
            stock_quantity, low_stock_threshold, is_featured, status, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', TRUE)`,
          [
            productName,
            `${template.category}-${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
            `<p>${template.description}</p><ul>${template.features.map((f: string) => `<li>${f}</li>`).join('')}</ul>`,
            template.shortDescription,
            categoryId,
            brandId,
            Math.round(basePrice * 100) / 100,
            compareAtPrice ? Math.round(compareAtPrice * 100) / 100 : null,
            template.weight[0] + Math.random() * (template.weight[1] - template.weight[0]),
            template.dimensions ? template.dimensions[0] : null,
            template.dimensions ? template.dimensions[1] : null,
            template.dimensions ? template.dimensions[2] : null,
            Math.floor(Math.random() * 200) + 50,
            10,
            Math.random() > 0.7,
          ]
        );
        const productId = productResult.insertId;

        // Add product images with unique variations
        const imageCount = Math.floor(Math.random() * 3) + 2; // 2-4 images per product
        for (let imgIdx = 0; imgIdx < imageCount; imgIdx++) {
          const imageColor = this.getRandomColor();
          const textColor = this.getContrastColor(imageColor);
          const imageUrl = `https://via.placeholder.com/800x800/${imageColor}/${textColor}?text=${encodeURIComponent(productName)}-${productId}-${imgIdx}`;
          await this.connection!.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, order_index, is_primary)
             VALUES (?, ?, ?, ?, ?)`,
            [productId, imageUrl, `${productName} - Image ${imgIdx + 1}`, imgIdx, imgIdx === 0]
          );
        }

        // Create variants if applicable
        if (template.hasVariants) {
          const variantCombinations = this.generateVariantCombinations(template.variantTypes);
          
          for (const combo of variantCombinations) {
            const variantName = Object.values(combo).join(' / ');
            const variantPrice = basePrice + (Math.random() * 10 - 5); // Price variation ±$5
            
            const [variantResult] = await this.connection!.query<any>(
              `INSERT INTO product_variants (
                product_id, name, sku, attributes, price, stock_quantity, weight, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
              [
                productId,
                variantName,
                `SKU-${productId}-${Object.values(combo).join('-').toUpperCase()}`,
                JSON.stringify(combo),
                Math.round(variantPrice * 100) / 100,
                Math.floor(Math.random() * 50) + 10,
                template.weight[0] + Math.random() * (template.weight[1] - template.weight[0])
              ]
            );

            // Add variant-specific image if it's a color variant
            if (combo.Color) {
              const colorCode = this.getColorCode(combo.Color);
              const textColor = this.getContrastColor(colorCode);
              const variantImageUrl = `https://via.placeholder.com/800x800/${colorCode}/${textColor}?text=${encodeURIComponent(variantName)}-${variantResult.insertId}`;
              await this.connection!.query(
                `INSERT INTO product_images (product_id, variant_id, image_url, alt_text, order_index, is_primary)
                 VALUES (?, ?, ?, ?, ?, FALSE)`,
                [productId, variantResult.insertId, variantImageUrl, `${productName} - ${variantName}`, 0]
              );
            }
            
            totalVariants++;
          }
        }

        totalProducts++;
        if (totalProducts % 50 === 0) {
          console.log(`  ✓ Created ${totalProducts} products...`);
        }
      }
    }

    console.log(`  ✓ Created ${totalProducts} products with ${totalVariants} variants`);
  }

  private getProductTemplates(): any[] {
    return [
      {
        category: 'running-shoes',
        count: 15,
        names: ['CloudRunner Pro', 'SpeedMax Elite', 'AirFlow Runner', 'UltraLight Racer', 'Marathon Master', 
                'TrailBlazer X', 'Urban Runner', 'Sprint Pro', 'EnduroMax', 'Velocity Runner',
                'Road Warrior', 'Distance Master', 'Pace Setter', 'Runner Elite', 'Swift Stride'],
        description: 'Engineered for optimal performance with advanced cushioning technology',
        shortDescription: 'Professional running shoes',
        features: ['Breathable mesh upper', 'Responsive cushioning', 'Durable rubber outsole', 'Lightweight design'],
        priceRange: [89.99, 179.99],
        weight: [0.25, 0.35],
        dimensions: [30, 20, 12],
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'training-shoes',
        count: 12,
        names: ['CrossFit Pro', 'Gym Master', 'Training Elite', 'FlexFit', 'PowerLift', 
                'WorkOut Max', 'Athlete Pro', 'Training Ground', 'FitMax', 'Gym Warrior',
                'CrossTrainer', 'FitPro Elite'],
        description: 'Versatile training shoes for gym workouts and cross-training',
        shortDescription: 'Multi-purpose training shoes',
        features: ['Stable platform', 'Flexible forefoot', 'Reinforced toe', 'Breathable materials'],
        priceRange: [79.99, 149.99],
        weight: [0.28, 0.38],
        dimensions: [30, 20, 12],
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'basketball-shoes',
        count: 10,
        names: ['HoopMaster Pro', 'Court Legend', 'Dunk Elite', 'Sky High', 'Crossover King',
                'Fast Break', 'Slam Dunk Pro', 'Court Vision', 'Hoop Dreams', 'B-Ball Elite'],
        description: 'High-performance basketball shoes with superior ankle support',
        shortDescription: 'Professional basketball shoes',
        features: ['High-top support', 'Responsive cushioning', 'Excellent traction', 'Impact protection'],
        priceRange: [99.99, 199.99],
        weight: [0.35, 0.45],
        dimensions: [32, 22, 15],
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'soccer-cleats',
        count: 12,
        names: ['StrikerPro Elite', 'GoalMaster', 'Field Dominator', 'Soccer Star', 'Kick Master',
                'Precision Touch', 'Speed Cleat', 'Game Changer', 'Field Legend', 'Soccer Elite',
                'Goal Getter', 'Match Winner'],
        description: 'Professional soccer cleats with superior ball control',
        shortDescription: 'High-performance soccer cleats',
        features: ['Premium synthetic upper', 'Precision studs', 'Enhanced ball control', 'Lightweight'],
        priceRange: [69.99, 159.99],
        weight: [0.22, 0.32],
        dimensions: [30, 20, 11],
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'athletic-apparel',
        count: 20,
        names: ['Performance Tank', 'Athletic Tee', 'Sport Polo', 'Training Jersey', 'Pro Shirt',
                'Workout Top', 'Sport Vest', 'Active Tee', 'Athlete Polo', 'Training Tank',
                'Sport Shirt', 'Pro Jersey', 'Active Top', 'Workout Tee', 'Sport Tank',
                'Athletic Polo', 'Training Top', 'Pro Vest', 'Performance Jersey', 'Active Shirt'],
        description: 'Breathable athletic wear made from moisture-wicking fabric',
        shortDescription: 'Comfortable performance apparel',
        features: ['Moisture-wicking', 'Quick-dry fabric', 'Anti-odor technology', 'Flexible fit'],
        priceRange: [24.99, 59.99],
        weight: [0.15, 0.25],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 't-shirts',
        count: 18,
        names: ['Classic Sport Tee', 'Athletic Basic', 'Everyday Active', 'Sport Essential', 'Casual Active',
                'Training Basic', 'Gym Essential', 'Active Life Tee', 'Sport Classic', 'Workout Basic',
                'Athlete Tee', 'Active Essential', 'Training Tee', 'Sport Basic', 'Gym Tee',
                'Active Classic', 'Workout Essential', 'Athlete Basic'],
        description: 'Comfortable cotton-blend t-shirts for everyday wear and light training',
        shortDescription: 'Versatile athletic t-shirts',
        features: ['Soft cotton blend', 'Comfortable fit', 'Durable construction', 'Easy care'],
        priceRange: [19.99, 39.99],
        weight: [0.12, 0.18],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'shorts',
        count: 15,
        names: ['Athletic Shorts', 'Running Shorts', 'Training Shorts', 'Sport Shorts', 'Active Shorts',
                'Workout Shorts', 'Performance Shorts', 'Gym Shorts', 'Quick-Dry Shorts', 'Sport Pro Shorts',
                'Training Pro', 'Active Performance', 'Athlete Shorts', 'Sport Elite Shorts', 'Pro Training Shorts'],
        description: 'Lightweight shorts perfect for running, training, and sports',
        shortDescription: 'Comfortable athletic shorts',
        features: ['Lightweight fabric', 'Elastic waistband', 'Side pockets', 'Breathable material'],
        priceRange: [24.99, 54.99],
        weight: [0.10, 0.18],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'hoodies-sweatshirts',
        count: 12,
        names: ['Sport Hoodie', 'Training Hoodie', 'Athletic Pullover', 'Performance Hoodie', 'Active Hoodie',
                'Workout Hoodie', 'Gym Pullover', 'Sport Pullover', 'Training Sweatshirt', 'Athlete Hoodie',
                'Pro Hoodie', 'Elite Pullover'],
        description: 'Warm and comfortable hoodies for training and casual wear',
        shortDescription: 'Cozy athletic hoodies',
        features: ['Soft fleece interior', 'Adjustable hood', 'Kangaroo pocket', 'Ribbed cuffs'],
        priceRange: [44.99, 89.99],
        weight: [0.40, 0.60],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'pants-joggers',
        count: 14,
        names: ['Athletic Joggers', 'Training Pants', 'Sport Joggers', 'Active Pants', 'Workout Joggers',
                'Performance Pants', 'Gym Joggers', 'Sport Pants', 'Training Joggers', 'Athlete Pants',
                'Pro Joggers', 'Elite Pants', 'Active Joggers', 'Sport Pro Pants'],
        description: 'Comfortable joggers and pants for training and casual wear',
        shortDescription: 'Versatile athletic pants',
        features: ['Elastic waistband', 'Tapered fit', 'Side pockets', 'Ankle cuffs'],
        priceRange: [39.99, 79.99],
        weight: [0.30, 0.45],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'sports-bags',
        count: 10,
        names: ['Athlete Backpack', 'Gym Duffel', 'Sport Backpack', 'Training Bag', 'Pro Backpack',
                'Sport Duffel', 'Athlete Duffel', 'Gym Backpack', 'Training Duffel', 'Pro Sport Bag'],
        description: 'Spacious and durable bags for all your sports gear',
        shortDescription: 'High-capacity sports bags',
        features: ['Multiple compartments', 'Padded straps', 'Water-resistant', 'Shoe compartment'],
        priceRange: [49.99, 99.99],
        weight: [0.50, 0.80],
        dimensions: [50, 30, 25],
        hasVariants: true,
        variantTypes: ['Color', 'Material']
      },
      {
        category: 'footballs',
        count: 8,
        names: ['Pro Match Ball', 'Training Soccer Ball', 'Elite Game Ball', 'Pro Training Ball',
                'Match Day Ball', 'Competition Ball', 'Practice Ball', 'Professional Ball'],
        description: 'Official size soccer balls for matches and training',
        shortDescription: 'Quality soccer balls',
        features: ['FIFA quality', 'Hand-stitched', 'Superior grip', 'Excellent durability'],
        priceRange: [29.99, 79.99],
        weight: [0.40, 0.45],
        dimensions: [22, 22, 22],
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'basketballs',
        count: 8,
        names: ['Pro Game Basketball', 'Training Basketball', 'Indoor Basketball', 'Outdoor Basketball',
                'Competition Ball', 'Practice Basketball', 'Elite Game Ball', 'Pro Training Ball'],
        description: 'Official size basketballs with excellent grip and control',
        shortDescription: 'Quality basketballs',
        features: ['Official size', 'Deep channels', 'Superior grip', 'Indoor/outdoor use'],
        priceRange: [34.99, 89.99],
        weight: [0.58, 0.62],
        dimensions: [24, 24, 24],
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'fitness-equipment',
        count: 12,
        names: ['Resistance Bands Set', 'Dumbbells Pair', 'Kettlebell', 'Yoga Block Set', 'Exercise Mat',
                'Jump Rope', 'Ab Roller', 'Push-up Bars', 'Resistance Tubes', 'Medicine Ball',
                'Foam Roller', 'Balance Board'],
        description: 'Essential fitness equipment for home and gym workouts',
        shortDescription: 'Home fitness gear',
        features: ['Durable construction', 'Easy to use', 'Portable', 'Versatile'],
        priceRange: [14.99, 89.99],
        weight: [0.50, 5.00],
        dimensions: [30, 20, 10],
        hasVariants: false,
        variantTypes: []
      },
      {
        category: 'yoga-pilates',
        count: 10,
        names: ['Premium Yoga Mat', 'Yoga Block Set', 'Pilates Ring', 'Yoga Strap', 'Mat Carrier',
                'Meditation Cushion', 'Yoga Wheel', 'Pilates Ball', 'Yoga Towel', 'Mat Bag'],
        description: 'Quality yoga and pilates equipment for practice and meditation',
        shortDescription: 'Yoga and pilates gear',
        features: ['Non-slip surface', 'Eco-friendly materials', 'Easy to clean', 'Portable'],
        priceRange: [19.99, 69.99],
        weight: [0.50, 2.00],
        dimensions: [180, 60, 0.5],
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'running-accessories',
        count: 12,
        names: ['Running Belt', 'Armband Phone Holder', 'LED Safety Light', 'Reflective Vest', 'Running Cap',
                'Sports Armband', 'Waist Pack', 'Phone Pouch', 'Safety Band', 'Visibility Vest',
                'Night Running Light', 'Hydration Belt'],
        description: 'Essential accessories for runners',
        shortDescription: 'Running accessories',
        features: ['Lightweight', 'Adjustable', 'Water-resistant', 'Reflective elements'],
        priceRange: [9.99, 39.99],
        weight: [0.05, 0.30],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'socks',
        count: 16,
        names: ['Athletic Socks 3-Pack', 'Running Socks', 'Sport Socks Set', 'Compression Socks', 'Training Socks',
                'No-Show Socks', 'Ankle Socks Pack', 'Performance Socks', 'Sport Ankle Socks', 'Athletic Crew Socks',
                'Running Ankle Socks', 'Training Pack', 'Gym Socks', 'Sport Crew Socks', 'Active Socks', 'Pro Socks Pack'],
        description: 'Comfortable athletic socks with arch support and cushioning',
        shortDescription: 'Athletic socks',
        features: ['Arch support', 'Cushioned sole', 'Moisture-wicking', 'Reinforced heel and toe'],
        priceRange: [12.99, 29.99],
        weight: [0.08, 0.15],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color', 'Size']
      },
      {
        category: 'caps-hats',
        count: 12,
        names: ['Sport Cap', 'Running Hat', 'Athletic Cap', 'Performance Hat', 'Sun Cap',
                'Training Cap', 'Sport Visor', 'Active Hat', 'Athlete Cap', 'Pro Hat',
                'Sport Beanie', 'Training Hat'],
        description: 'Breathable sports caps and hats for sun protection',
        shortDescription: 'Athletic headwear',
        features: ['Moisture-wicking sweatband', 'Adjustable strap', 'UV protection', 'Breathable fabric'],
        priceRange: [14.99, 34.99],
        weight: [0.05, 0.12],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'gloves',
        count: 10,
        names: ['Training Gloves', 'Gym Gloves', 'Workout Gloves', 'Lifting Gloves', 'Crossfit Gloves',
                'Fitness Gloves', 'Exercise Gloves', 'Power Gloves', 'Grip Gloves', 'Pro Training Gloves'],
        description: 'Durable training gloves for weightlifting and gym workouts',
        shortDescription: 'Training gloves',
        features: ['Padded palms', 'Wrist support', 'Breathable material', 'Superior grip'],
        priceRange: [14.99, 39.99],
        weight: [0.08, 0.15],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Size']
      },
      {
        category: 'water-bottles',
        count: 12,
        names: ['Hydration Bottle 750ml', 'Sport Bottle 1L', 'Insulated Bottle', 'Steel Water Bottle', 'BPA-Free Bottle',
                'Sport Hydration 500ml', 'Squeeze Bottle', 'Thermal Bottle', 'Sport Flask', 'Gym Bottle',
                'Active Hydration', 'Pro Water Bottle'],
        description: 'Stay hydrated with our range of sports water bottles',
        shortDescription: 'Sports water bottles',
        features: ['Leak-proof', 'BPA-free', 'Easy-grip design', 'Wide mouth opening'],
        priceRange: [9.99, 34.99],
        weight: [0.15, 0.35],
        dimensions: [25, 8, 8],
        hasVariants: true,
        variantTypes: ['Color']
      },
      {
        category: 'watches-trackers',
        count: 10,
        names: ['Fitness Tracker Pro', 'Sport Watch', 'Activity Monitor', 'Heart Rate Watch', 'GPS Running Watch',
                'Fitness Band', 'Smart Sport Watch', 'Training Tracker', 'Pro Fitness Watch', 'Elite Activity Tracker'],
        description: 'Track your workouts and daily activity with advanced fitness technology',
        shortDescription: 'Fitness trackers and watches',
        features: ['Heart rate monitor', 'GPS tracking', 'Water-resistant', 'Sleep tracking', 'Long battery life'],
        priceRange: [79.99, 299.99],
        weight: [0.03, 0.08],
        dimensions: null,
        hasVariants: true,
        variantTypes: ['Color']
      }
    ];
  }

  private generateVariantCombinations(variantTypes: string[]): any[] {
    const colorValues = ['Black', 'White', 'Red', 'Blue', 'Green'];
    const sizeValues = ['S', 'M', 'L', 'XL'];
    const materialValues = ['Nylon', 'Polyester', 'Canvas'];

    if (variantTypes.length === 0) return [];

    if (variantTypes.length === 1) {
      const type = variantTypes[0];
      const values = type === 'Color' ? colorValues.slice(0, 3) : 
                     type === 'Size' ? sizeValues : 
                     materialValues.slice(0, 2);
      return values.map(v => ({ [type]: v }));
    }

    if (variantTypes.length === 2) {
      const combinations: any[] = [];
      const type1 = variantTypes[0];
      const type2 = variantTypes[1];
      
      const values1 = type1 === 'Color' ? colorValues.slice(0, 3) : 
                      type1 === 'Size' ? sizeValues : 
                      materialValues.slice(0, 2);
      
      const values2 = type2 === 'Color' ? colorValues.slice(0, 3) : 
                      type2 === 'Size' ? sizeValues : 
                      materialValues.slice(0, 2);

      values1.forEach(v1 => {
        values2.forEach(v2 => {
          combinations.push({ [type1]: v1, [type2]: v2 });
        });
      });

      return combinations;
    }

    return [];
  }

  private getRandomColor(): string {
    const colors = ['007bff', '28a745', 'dc3545', 'ffc107', '17a2b8', '6c757d', 'e83e8c', 'fd7e14'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private getColorCode(colorName: string): string {
    const colorMap: any = {
      'Black': '000000',
      'White': 'EEEEEE',
      'Red': 'FF0000',
      'Blue': '0000FF',
      'Green': '008000',
      'Yellow': 'FFFF00'
    };
    return colorMap[colorName] || '808080';
  }

  private getContrastColor(hexColor: string): string {
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '000000' : 'FFFFFF';
  }
}

// Run seeding if called directly
if (require.main === module) {
  const seeder = new ComprehensiveEcommerceSeed();
  
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

export default ComprehensiveEcommerceSeed;
