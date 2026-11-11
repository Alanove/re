import { db } from '../../src/config/database';
import { Product, ProductWithDetails } from '../../src/services/productService';
import * as mysql from 'mysql2/promise';

export interface ProductCreateData {
  name: string;
  slug: string;
  sku?: string | undefined;
  short_description?: string | undefined;
  description?: string | undefined;
  price: number;
  compare_at_price?: number | undefined;
  cost_price?: number | undefined;
  weight?: number | undefined;
  length?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  stock_quantity?: number | undefined;
  low_stock_threshold?: number | undefined;
  track_inventory?: boolean | undefined;
  is_featured?: boolean | undefined;
  is_new_arrival?: boolean | undefined;
  is_active?: boolean | undefined;
  status?: string | undefined;
  category_id?: number | undefined;
  category_ids?: number[] | undefined;
  brand_id?: number | null | undefined;
  size_chart_id?: number | undefined;
  meta_title?: string | undefined;
  meta_description?: string | undefined;
  meta_keywords?: string | undefined;
}

export interface ProductVariantData {
  product_id: number;
  sku?: string;
  name: string;
  attributes: any; // JSON object
  price?: number;
  compare_at_price?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  track_inventory?: boolean;
  weight?: number;
  is_default?: boolean;
  has_image?: boolean;
}

export class ProductManagementService {
  private static instance: ProductManagementService;

  private constructor() { }

  public static getInstance(): ProductManagementService {
    if (!ProductManagementService.instance) {
      ProductManagementService.instance = new ProductManagementService();
    }
    return ProductManagementService.instance;
  }

  /**
   * Create product
   */
  public async createProduct(data: ProductCreateData): Promise<Product> {
    try {
      const [result] = await db.query(
        `INSERT INTO products (
          name, slug, sku, short_description, description, price, compare_at_price,
          cost_price, weight, length, width, height, stock_quantity, low_stock_threshold,
          track_inventory, is_featured, is_new_arrival, is_active, status, category_id, brand_id, size_chart_id,
          meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.slug,
          data.sku || null,
          data.short_description || null,
          data.description || null,
          data.price,
          data.compare_at_price || null,
          data.cost_price || null,
          data.weight || null,
          data.length || null,
          data.width || null,
          data.height || null,
          data.stock_quantity || 0,
          data.low_stock_threshold || 5,
          data.track_inventory !== undefined ? data.track_inventory : true,
          data.is_featured || false,
          data.is_new_arrival || false,
          data.is_active !== undefined ? data.is_active : true,
          data.status || 'draft',
          data.category_id || null,
          data.brand_id ?? null,
          data.size_chart_id || null,
          data.meta_title || null,
          data.meta_description || null,
          data.meta_keywords || null
        ]
      );

      const productId = (result as unknown as mysql.ResultSetHeader).insertId;

      // Handle categories
      if (data.category_ids && data.category_ids.length > 0) {
        const values = data.category_ids.map(catId => [productId, catId]);
        await db.query(
          'INSERT INTO product_category_relations (product_id, category_id) VALUES ?',
          [values]
        );
      } else if (data.category_id) {
        await db.query(
          'INSERT INTO product_category_relations (product_id, category_id) VALUES (?, ?)',
          [productId, data.category_id]
        );
      }

      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error('Failed to retrieve created product');
      }
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * Update product
   */
  public async updateProduct(id: number, data: Partial<ProductCreateData>): Promise<Product> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'category_ids') {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      });

      // Handle Category Updates
      if (data.category_ids !== undefined) {
        // Determine primary category (first one)
        const primaryCategory = data.category_ids.length > 0 ? data.category_ids[0] : null;
        updates.push('category_id = ?');
        values.push(primaryCategory);
      }

      if (updates.length === 0) {
        const product = await this.getProductById(id);
        if (!product) {
          throw new Error('Product not found');
        }
        return product;
      }

      values.push(id);
      await db.query(
        `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      // Update relations if category_ids provided
      if (data.category_ids !== undefined) {
        // Delete existing
        await db.query('DELETE FROM product_category_relations WHERE product_id = ?', [id]);

        // Insert new
        if (data.category_ids.length > 0) {
          const relationValues = data.category_ids.map(catId => [id, catId]);
          await db.query(
            'INSERT INTO product_category_relations (product_id, category_id) VALUES ?',
            [relationValues]
          );
        }
      }

      const product = await this.getProductById(id);
      if (!product) {
        throw new Error('Product not found');
      }
      return product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  /**
   * Delete product
   */
  public async deleteProduct(id: number): Promise<void> {
    try {
      const [orderRows] = await db.query<any>(
        'SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?',
        [id]
      );
      if (orderRows[0].count > 0) {
        throw new Error('Cannot delete this product because it is referenced by existing orders. Consider deactivating it instead.');
      }

      await db.query('DELETE FROM products WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  public async getProductById(id: number): Promise<Product | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      if (rows.length > 0) {
        const product = rows[0];
        // Fetch category IDs
        const [catRows] = await db.query<any>(
          'SELECT category_id FROM product_category_relations WHERE product_id = ?',
          [id]
        );
        (product as any).category_ids = catRows.map((r: any) => r.category_id);
        return product;
      }
      return null;
    } catch (error) {
      console.error('Error getting product by ID:', error);
      throw error;
    }
  }

  /**
   * Get all products with pagination
   */
  public async getAllProducts(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      category_id?: number;
      status?: string;
      is_featured?: boolean;
      is_new_arrival?: boolean;
    }
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      if (filters?.search) {
        whereConditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters?.category_id) {
        whereConditions.push('p.id IN (SELECT product_id FROM product_category_relations WHERE category_id = ?)');
        queryParams.push(filters.category_id);
      }

      if (filters?.status) {
        whereConditions.push('p.status = ?');
        queryParams.push(filters.status);
      }

      if (filters?.is_featured !== undefined) {
        whereConditions.push('p.is_featured = ?');
        queryParams.push(filters.is_featured);
      }

      if (filters?.is_new_arrival !== undefined) {
        whereConditions.push('p.is_new_arrival = ?');
        queryParams.push(filters.is_new_arrival);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total
      const [countRows] = await db.query<any>(
        `SELECT COUNT(*) as count FROM products p ${whereClause}`,
        queryParams
      );
      const total = countRows.length > 0 ? ((countRows[0] as unknown) as { count: number }).count : 0;

      // Get products with category name
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      const [rows] = await db.query<any>(
        `SELECT p.*,
                (SELECT GROUP_CONCAT(pc.name SEPARATOR ', ') 
                 FROM product_category_relations pcr 
                 JOIN product_categories pc ON pcr.category_id = pc.id 
                 WHERE pcr.product_id = p.id) as category_name
         FROM products p
         ${whereClause} 
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      // Get images for each product
      const productsWithImages = await Promise.all(rows.map(async (product: any) => {
        const [imageRows] = await db.query<any>(
          'SELECT image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC LIMIT 5',
          [product.id]
        );
        return {
          ...product,
          images: imageRows || []
        };
      }));

      return {
        products: productsWithImages,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting all products:', error);
      throw error;
    }
  }

  /**
   * Add product variant
   */
  public async addProductVariant(data: ProductVariantData): Promise<number> {
    try {
      const [result] = await db.query<any>(
        `INSERT INTO product_variants(
        product_id, sku, name, attributes, price, compare_at_price,
        stock_quantity, low_stock_threshold, track_inventory, weight, is_default, has_image
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.product_id,
          data.sku || null,
          data.name,
          JSON.stringify(data.attributes),
          data.price || null,
          data.compare_at_price || null,
          data.stock_quantity || 0,
          data.low_stock_threshold || 5,
          data.track_inventory !== undefined ? data.track_inventory : true,
          data.weight || null,
          data.is_default || false,
          data.has_image || false
        ]
      );
      return (result as unknown as mysql.ResultSetHeader).insertId;
    } catch (error) {
      console.error('Error adding product variant:', error);
      throw error;
    }
  }

  /**
   * Update product variant
   */
  public async updateProductVariant(id: number, data: Partial<ProductVariantData>): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'product_id') {
          if (key === 'attributes') {
            updates.push('attributes = ?');
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }
      });

      if (updates.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE product_variants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? `,
          values
        );
      }
    } catch (error) {
      console.error('Error updating product variant:', error);
      throw error;
    }
  }

  /**
   * Delete product variant
   */
  public async deleteProductVariant(id: number): Promise<void> {
    try {
      await db.query('DELETE FROM product_variants WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting product variant:', error);
      throw error;
    }
  }

  /**
   * Add product image
   */
  public async addProductImage(
    productId: number,
    variantId: number | null | undefined,
    imageUrl: string,
    altText?: string | undefined,
    isPrimary: boolean = false,
    orderIndex: number = 0,
    thumbUrl?: string | null
  ): Promise<number> {
    try {
      // If setting as primary, unset other primary images
      if (isPrimary) {
        await db.query(
          'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
          [productId]
        );
      }

      const [result] = await db.query(
        `INSERT INTO product_images(
        product_id, variant_id, image_url, thumb_url, alt_text, is_primary, order_index
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, imageUrl, thumbUrl ?? null, altText || null, isPrimary, orderIndex]
      );
      // force cast to any to avoid type error with insertId on array
      return (result as any).insertId;
    } catch (error) {
      console.error('Error adding product image:', error);
      throw error;
    }
  }

  /**
   * Delete product image
   */
  public async deleteProductImage(imageId: number): Promise<void> {
    try {
      await db.query('DELETE FROM product_images WHERE id = ?', [imageId]);
    } catch (error) {
      console.error('Error deleting product image:', error);
      throw error;
    }
  }

  /**
   * Get all product images
   */
  public async getProductImages(productId: number): Promise<any[]> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC',
        [productId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting product images:', error);
      throw error;
    }
  }

  /**
   * Update product image order
   */
  public async updateProductImageOrder(imageId: number, orderIndex: number): Promise<void> {
    try {
      await db.query(
        'UPDATE product_images SET order_index = ? WHERE id = ?',
        [orderIndex, imageId]
      );
    } catch (error) {
      console.error('Error updating product image order:', error);
      throw error;
    }
  }

  /**
   * Set product image as primary
   */
  public async setPrimaryImage(productId: number, imageId: number): Promise<void> {
    try {
      // Unset all primary images for this product
      await db.query(
        'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
        [productId]
      );
      // Set this image as primary
      await db.query(
        'UPDATE product_images SET is_primary = TRUE WHERE id = ?',
        [imageId]
      );
    } catch (error) {
      console.error('Error setting primary image:', error);
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  public async getLowStockProducts(): Promise<Product[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT * FROM products 
        WHERE track_inventory = TRUE 
        AND stock_quantity <= low_stock_threshold 
        AND is_active = TRUE
        ORDER BY stock_quantity ASC`
      );
      return rows;
    } catch (error) {
      console.error('Error getting low stock products:', error);
      throw error;
    }
  }

  /**
   * Bulk update stock
   */
  public async bulkUpdateStock(updates: Array<{ product_id: number; variant_id?: number; quantity: number }>): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const update of updates) {
        if (update.variant_id) {
          await connection.query(
            'UPDATE product_variants SET stock_quantity = ? WHERE id = ?',
            [update.quantity, update.variant_id]
          );
        } else {
          await connection.query(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [update.quantity, update.product_id]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error bulk updating stock:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  /**
   * Bulk create product variants
   */
  public async createProductVariantsBulk(variantsData: ProductVariantData[]): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const data of variantsData) {
        await connection.query(
          `INSERT INTO product_variants(
        product_id, sku, name, attributes, price, compare_at_price,
        stock_quantity, low_stock_threshold, track_inventory, weight, is_default, has_image
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.product_id,
            data.sku || null,
            data.name,
            JSON.stringify(data.attributes),
            data.price || null,
            data.compare_at_price || null,
            data.stock_quantity || 0,
            data.low_stock_threshold || 5,
            data.track_inventory !== undefined ? data.track_inventory : true,
            data.weight || null,
            data.is_default || false,
            data.has_image || false
          ]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error bulk creating product variants:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default ProductManagementService.getInstance();

