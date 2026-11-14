import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../src/config/database';
import { Product, ProductWithDetails } from '../../src/services/productService';
import * as mysql from 'mysql2/promise';
import { getProductImagePublicUrl, getProductImagesDirPath } from '../../src/constants/data-paths';
import { generateThumbForPublicUrl, publicUrlToAbsolutePath } from '../../src/services/imageThumbService';

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
  is_on_sale?: boolean | undefined;
  is_active?: boolean | undefined;
  include_in_auto_ads?: boolean | undefined;
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
          track_inventory, is_featured, is_on_sale, is_active, include_in_auto_ads, status, category_id, brand_id, size_chart_id,
          meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          data.is_on_sale || false,
          data.is_active !== undefined ? data.is_active : true,
          data.include_in_auto_ads !== undefined ? data.include_in_auto_ads : true,
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
      is_on_sale?: boolean;
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
        whereConditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
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

      if (filters?.is_on_sale !== undefined) {
        whereConditions.push('p.is_on_sale = ?');
        queryParams.push(filters.is_on_sale);
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
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC',
        [productId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting product images:', error);
      throw error;
    }
  }

  /**
   * Save gallery order from a drag-and-drop list of image ids.
   */
  public async reorderProductImages(productId: number, imageIds: number[]): Promise<void> {
    const [rows] = await db.query<any>(
      'SELECT id FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC',
      [productId]
    );
    const allowed = rows.map((row: { id: number }) => Number(row.id));
    const allowedSet = new Set(allowed);
    const ordered = imageIds.filter((id) => allowedSet.has(id));
    for (const id of allowed) {
      if (!ordered.includes(id)) ordered.push(id);
    }

    for (let i = 0; i < ordered.length; i++) {
      await db.query('UPDATE product_images SET order_index = ? WHERE id = ? AND product_id = ?', [
        i,
        ordered[i],
        productId
      ]);
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

  /**
   * Duplicate a product, including categories, attribute selections, variants,
   * stock, and a separate copy of every product image file.
   */
  public async duplicateProduct(sourceId: number): Promise<number> {
    const connection = await db.getConnection();
    let newProductId = 0;
    let copiedFiles = false;
    try {
      await connection.beginTransaction();

      const [srcRows] = await connection.query<any>('SELECT * FROM products WHERE id = ?', [sourceId]);
      if (!srcRows.length) {
        throw new Error('Product not found');
      }
      const src = srcRows[0];
      const usedSkus = new Set<string>();
      const name = await this.uniqueCopyName(connection, String(src.name || 'Product'));
      const slug = await this.uniqueSlug(connection, this.slugifyName(name));
      const sku = src.sku ? await this.allocateCopySku(connection, String(src.sku), usedSkus) : null;

      const [insertResult] = await connection.query<any>(
        `INSERT INTO products (
          name, slug, sku, short_description, description, price, compare_at_price,
          cost_price, weight, length, width, height, stock_quantity, low_stock_threshold,
          track_inventory, is_featured, is_on_sale, is_active, include_in_auto_ads, status, category_id, brand_id, size_chart_id,
          meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          slug,
          sku,
          src.short_description ?? null,
          src.description ?? null,
          src.price,
          src.compare_at_price ?? null,
          src.cost_price ?? null,
          src.weight ?? null,
          src.length ?? null,
          src.width ?? null,
          src.height ?? null,
          src.stock_quantity ?? 0,
          src.low_stock_threshold ?? 5,
          src.track_inventory ?? true,
          src.is_featured ?? false,
          src.is_on_sale ?? false,
          src.is_active ?? true,
          src.include_in_auto_ads ?? true,
          src.status || 'draft',
          src.category_id ?? null,
          src.brand_id ?? null,
          src.size_chart_id ?? null,
          src.meta_title ?? null,
          src.meta_description ?? null,
          src.meta_keywords ?? null
        ]
      );
      newProductId = (insertResult as mysql.ResultSetHeader).insertId;

      await connection.query(
        `INSERT INTO product_category_relations (product_id, category_id)
         SELECT ?, category_id FROM product_category_relations WHERE product_id = ?`,
        [newProductId, sourceId]
      );

      const [attributeRows] = await connection.query<any>(
        'SELECT variant_type_id, selected_values FROM product_attributes WHERE product_id = ?',
        [sourceId]
      );
      for (const row of attributeRows) {
        const selected = row.selected_values == null
          ? null
          : typeof row.selected_values === 'string'
            ? row.selected_values
            : JSON.stringify(row.selected_values);
        await connection.query(
          'INSERT INTO product_attributes (product_id, variant_type_id, selected_values) VALUES (?, ?, ?)',
          [newProductId, row.variant_type_id, selected]
        );
      }

      const [variants] = await connection.query<any>(
        'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC',
        [sourceId]
      );
      const variantIdMap = new Map<number, number>();
      for (const variant of variants) {
        const variantSku = variant.sku
          ? await this.allocateCopySku(connection, String(variant.sku), usedSkus)
          : null;
        const attributes = variant.attributes == null
          ? '{}'
          : typeof variant.attributes === 'string'
            ? variant.attributes
            : JSON.stringify(variant.attributes);
        const [variantInsert] = await connection.query<any>(
          `INSERT INTO product_variants (
            product_id, sku, name, attributes, price, compare_at_price,
            stock_quantity, low_stock_threshold, track_inventory, weight, is_default, is_active, has_image
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newProductId,
            variantSku,
            variant.name,
            attributes,
            variant.price ?? null,
            variant.compare_at_price ?? null,
            variant.stock_quantity ?? 0,
            variant.low_stock_threshold ?? 5,
            variant.track_inventory ?? true,
            variant.weight ?? null,
            variant.is_default ?? false,
            variant.is_active ?? true,
            variant.has_image ?? false
          ]
        );
        variantIdMap.set(Number(variant.id), (variantInsert as mysql.ResultSetHeader).insertId);
      }

      const [images] = await connection.query<any>(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC',
        [sourceId]
      );
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const newUrl = await this.copyImageToProductFolder(String(image.image_url || ''), newProductId, i);
        if (!newUrl) continue;
        copiedFiles = true;
        const thumbUrl = await generateThumbForPublicUrl(newUrl);
        const newVariantId = image.variant_id != null
          ? (variantIdMap.get(Number(image.variant_id)) ?? null)
          : null;
        await connection.query(
          `INSERT INTO product_images (
            product_id, variant_id, image_url, thumb_url, alt_text, is_primary, order_index, attribute_value_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newProductId,
            newVariantId,
            newUrl,
            thumbUrl,
            image.alt_text ?? null,
            image.is_primary ?? false,
            image.order_index ?? i,
            image.attribute_value_id ?? null
          ]
        );
      }

      await connection.commit();
      return newProductId;
    } catch (error) {
      await connection.rollback();
      if (copiedFiles && newProductId) {
        fs.rmSync(getProductImagesDirPath(newProductId), { recursive: true, force: true });
      }
      console.error('Error duplicating product:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  private slugifyName(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'product';
  }

  private async uniqueCopyName(connection: mysql.PoolConnection, original: string): Promise<string> {
    let name = `${original} - Copy`;
    let n = 2;
    while (true) {
      const [rows] = await connection.query<any>('SELECT id FROM products WHERE name = ? LIMIT 1', [name]);
      if (!rows.length) return name;
      name = `${original} - Copy ${n}`;
      n++;
    }
  }

  private async uniqueSlug(connection: mysql.PoolConnection, base: string): Promise<string> {
    let slug = base.slice(0, 480);
    let n = 2;
    while (true) {
      const [rows] = await connection.query<any>('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
      if (!rows.length) return slug;
      slug = `${base.slice(0, 470)}-${n}`;
      n++;
    }
  }

  private async allocateCopySku(
    connection: mysql.PoolConnection,
    base: string,
    used: Set<string>
  ): Promise<string> {
    const root = base.trim().toUpperCase().slice(0, 240) || 'PRODUCT';
    let n = 1;
    while (n < 100000) {
      const suffix = n === 1 ? '-COPY' : `-COPY-${n}`;
      const candidate = `${root.slice(0, 255 - suffix.length)}${suffix}`;
      if (!used.has(candidate)) {
        const [productRows] = await connection.query<any>(
          'SELECT id FROM products WHERE sku = ? LIMIT 1',
          [candidate]
        );
        const [variantRows] = await connection.query<any>(
          'SELECT id FROM product_variants WHERE sku = ? LIMIT 1',
          [candidate]
        );
        if (!productRows.length && !variantRows.length) {
          used.add(candidate);
          return candidate;
        }
      }
      n++;
    }
    const fallback = `${root.slice(0, 200)}-COPY-${Date.now().toString(36).toUpperCase()}`;
    used.add(fallback);
    return fallback;
  }

  private async copyImageToProductFolder(
    sourceUrl: string,
    productId: number,
    index: number
  ): Promise<string | null> {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return null;

    const destDir = getProductImagesDirPath(productId);
    fs.mkdirSync(destDir, { recursive: true });
    const cleanPath = trimmed.split('?')[0];
    const ext = path.extname(cleanPath).toLowerCase();
    const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '.jpg';
    const filename = `product-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    const destAbs = path.join(destDir, filename);

    if (/^https?:\/\//i.test(trimmed)) {
      const response = await fetch(trimmed);
      if (!response.ok) {
        console.warn('Could not download product image', trimmed, response.status);
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(destAbs, buffer);
    } else {
      const abs = publicUrlToAbsolutePath(trimmed);
      if (!abs || !fs.existsSync(abs)) {
        console.warn('Product image file missing, skipped', trimmed);
        return null;
      }
      fs.copyFileSync(abs, destAbs);
    }

    return getProductImagePublicUrl(productId, filename);
  }
}

export default ProductManagementService.getInstance();

