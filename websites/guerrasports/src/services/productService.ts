import { db } from '../config/database';
import { ProductAttributeService } from '../../admin/services/productAttributeService';
import { buildColorOptionsForListing } from './variantDisplayService';
import { resolveListingThumbUrl } from './imageThumbService';
import { normalizeProductImageRow, normalizeProductImages } from './productImageUrlService';

export type { VariantDisplayModel } from './variantDisplayService';

/**
 * For products with multiple variant prices, sets variant_price_min, variant_price_max, and has_multi_prices for listing/PDP display.
 */
export function attachMultiPriceListingFieldsForProduct(product: any, variants: any[]): void {
  if (!variants || variants.length === 0) {
    product.has_multi_prices = false;
    return;
  }
  const prices: number[] = [];
  for (const v of variants) {
    if (v && v.price != null && String(v.price) !== '') {
      const n = Number(v.price);
      if (Number.isFinite(n)) {
        prices.push(n);
      }
    }
  }
  if (prices.length === 0) {
    product.has_multi_prices = false;
    return;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  product.variant_price_min = min;
  product.variant_price_max = max;
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const uniques = new Set(prices.map(round2));
  product.has_multi_prices = uniques.size > 1;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  is_featured: boolean;
  is_on_sale?: boolean;
  is_active: boolean;
  include_in_auto_ads: boolean;
  status: string;
  category_id: number | null;
  size_chart_id: number | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  rating_average: number;
  rating_count: number;
  view_count: number;
  created_at: Date;
  updated_at: Date;
  has_variants?: boolean;
}

export interface ProductWithDetails extends Product {
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  brand?: {
    id: number;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images?: Array<{
    id: number;
    image_url: string;
    alt_text: string | null;
    is_primary: boolean;
    order_index: number;
    attribute_value_id?: number | null;
  }>;
  variants?: Array<{
    id: number;
    sku: string | null;
    name: string;
    attributes: any;
    price: number | null;
    stock_quantity: number;
    is_default: boolean;
  }>;
}

export interface ProductFilters {
  category_id?: number;
  category_slug?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  is_featured?: boolean;
  is_active?: boolean;
  status?: string;
  in_stock?: boolean;
  /** Product or an active variant has compare_at_price above the selling price. */
  on_sale?: boolean;
  sort_by?: 'name' | 'price' | 'created_at' | 'rating' | 'popularity';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export class ProductService {
  private static instance: ProductService;

  private constructor() { }

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  /**
   * Get product by ID
   */
  public async getProductById(id: number): Promise<Product | null> {
    try {
      const [rows] = await db.query<Product>(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting product by ID:', error);
      throw error;
    }
  }

  /**
   * Get product by slug
   */
  public async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const [rows] = await db.query<Product>(
        'SELECT * FROM products WHERE slug = ?',
        [slug]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting product by slug:', error);
      throw error;
    }
  }

  /**
   * Get product with full details (category, images, variants)
   */
  public async getProductWithDetails(id: number): Promise<ProductWithDetails | null> {
    try {
      const product = await this.getProductById(id);
      if (!product) return null;

      // Get main category (first one or from field)
      let category = null;
      if (product.category_id) {
        const [categoryRows] = await db.query<any>(
          'SELECT id, name, slug FROM product_categories WHERE id = ?',
          [product.category_id]
        );
        if (categoryRows.length > 0) {
          category = categoryRows[0];
        }
      }

      // Get all categories
      const [allCategoryRows] = await db.query<any>(
        `SELECT pc.id, pc.name, pc.slug 
         FROM product_categories pc
         JOIN product_category_relations pcr ON pc.id = pcr.category_id
         WHERE pcr.product_id = ?`,
        [id]
      );

      // Get images (attribute_value_id links gallery image to a variant color/value)
      const [imageRows] = await db.query<any>(
        'SELECT id, image_url, thumb_url, alt_text, is_primary, order_index, attribute_value_id FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC, id ASC',
        [id]
      );

      // Get variants (include track_inventory for client-side stock checks)
      const [variantRows] = await db.query<any>(
        'SELECT id, sku, name, attributes, price, compare_at_price, stock_quantity, is_default, track_inventory FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY is_default DESC, id ASC',
        [id]
      );

      const variants = variantRows.map(v => ({
        ...v,
        attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes
      }));

      // Get brand (with logo) when product has brand_id
      let brand: { id: number; name: string; slug: string; logo_url: string | null } | null = null;
      const brandId = (product as any).brand_id;
      if (brandId) {
        const [brandRows] = await db.query<any>(
          'SELECT id, name, slug, logo_url FROM brands WHERE id = ? AND is_active = TRUE',
          [brandId]
        );
        if (brandRows.length > 0) brand = brandRows[0];
      }

      return {
        ...product,
        category,
        brand,
        categories: allCategoryRows,
        images: normalizeProductImages(id, imageRows),
        variants
      };
    } catch (error) {
      console.error('Error getting product with details:', error);
      throw error;
    }
  }

  /**
   * Get products with filters and pagination
   */
  public async getProducts(filters: ProductFilters = {}): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        category_id,
        category_slug,
        search,
        min_price,
        max_price,
        is_featured,
        is_active = true,
        status = 'published',
        in_stock,
        sort_by = 'created_at',
        sort_order = 'DESC',
        page = 1,
        limit = 20
      } = filters;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Build WHERE clause
      if (category_id) {
        whereConditions.push('p.id IN (SELECT product_id FROM product_category_relations WHERE category_id = ?)');
        queryParams.push(category_id);
      }

      if (category_slug) {
        whereConditions.push('p.id IN (SELECT pcr.product_id FROM product_category_relations pcr JOIN product_categories pc ON pcr.category_id = pc.id WHERE pc.slug = ?)');
        queryParams.push(category_slug);
      }

      // Brand filtering
      if ((filters as any).brand_id) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push((filters as any).brand_id);
      }

      if ((filters as any).brand_slug) {
        whereConditions.push('p.brand_id IN (SELECT id FROM brands WHERE slug = ?)');
        queryParams.push((filters as any).brand_slug);
      }

      if (search) {
        whereConditions.push('(MATCH(p.name, p.short_description, p.description) AGAINST(? IN BOOLEAN MODE) OR p.name LIKE ? OR p.sku LIKE ?)');
        const searchTerm = `*${search}*`;
        queryParams.push(searchTerm, `%${search}%`, `%${search}%`);
      }

      if (min_price !== undefined) {
        whereConditions.push('p.price >= ?');
        queryParams.push(min_price);
      }

      if (max_price !== undefined) {
        whereConditions.push('p.price <= ?');
        queryParams.push(max_price);
      }

      if (is_featured !== undefined) {
        whereConditions.push('p.is_featured = ?');
        queryParams.push(is_featured);
      }

      if (is_active !== undefined) {
        whereConditions.push('p.is_active = ?');
        queryParams.push(is_active);
      }

      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }

      if (in_stock) {
        whereConditions.push('(p.track_inventory = FALSE OR p.stock_quantity > 0)');
      }

      if (filters.on_sale) {
        whereConditions.push('p.is_on_sale = 1');
      }

      // Handle attribute filters
      if ((filters as any).attributes && Object.keys((filters as any).attributes).length > 0) {
        const attributeFilters = (filters as any).attributes;
        const attributeConditions: string[] = [];
        const attributeParams: any[] = [];

        // For each attribute filter (e.g., pa_color: ["Black & Blue"])
        for (const [attrSlug, valueArray] of Object.entries(attributeFilters)) {
          if (Array.isArray(valueArray) && valueArray.length > 0) {
            // Find variant_type_id by slug
            const [variantTypeRows] = await db.query<any>(
              'SELECT id FROM variant_types WHERE slug = ? AND is_active = TRUE',
              [attrSlug]
            );

            if (variantTypeRows.length > 0) {
              const variantTypeId = variantTypeRows[0].id;

              // Find variant_type_value IDs by matching value strings
              const placeholders = (valueArray as string[]).map(() => '?').join(',');
              const [valueRows] = await db.query<any>(
                `SELECT id FROM variant_type_values WHERE variant_type_id = ? AND value IN (${placeholders}) AND is_active = TRUE`,
                [variantTypeId, ...(valueArray as string[])]
              );

              if (valueRows.length > 0) {
                const valueIds = valueRows.map((row: any) => row.id);
                // Filter products where product_attributes.selected_values JSON contains any of these value IDs
                // Build JSON_CONTAINS checks - each value ID needs to be in a JSON array format
                const valueChecks = valueIds.map((id, index) => {
                  // Use JSON_CONTAINS to check if the array contains the value ID
                  // The value needs to be passed as a JSON array containing the number
                  return `JSON_CONTAINS(selected_values, ?)`;
                }).join(' OR ');
                
                attributeConditions.push(
                  `p.id IN (
                    SELECT product_id FROM product_attributes 
                    WHERE variant_type_id = ? 
                    AND (${valueChecks})
                  )`
                );
                // Pass each value ID as a JSON array string: "[123]" for value ID 123
                attributeParams.push(variantTypeId, ...valueIds.map(id => JSON.stringify([id])));
              }
            }
          }
        }

        // All attribute filters must match (AND logic)
        if (attributeConditions.length > 0) {
          whereConditions.push(`(${attributeConditions.join(' AND ')})`);
          queryParams.push(...attributeParams);
        }
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const [countRows] = await db.query<any>(
        `SELECT COUNT(*) as count FROM products p ${whereClause}`,
        queryParams
      );
      const total = countRows[0]?.count || 0;

      // Validate sort_by
      const validSortFields = ['name', 'price', 'created_at', 'rating_average', 'view_count'];
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);


      // Get products
      const [rows] = await db.query<Product>(
        `SELECT p.*, (SELECT COUNT(*) > 0 FROM product_variants WHERE product_id = p.id AND is_active = TRUE) as has_variants FROM products p ${whereClause} ORDER BY p.${sortField} ${sortDirection} LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      // Fetch images for these products
      if (rows.length > 0) {
        const productIds = rows.map(p => p.id);
        const [imageRows] = await db.query<any>(
          `SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`,
          [productIds]
        );

        // Map images to products
        rows.forEach((product: any) => {
          product.has_variants = product.has_variants === 1 || product.has_variants === true; // Convert to boolean
          product.images = imageRows.filter((img: any) => img.product_id === product.id).map((img: any) => {
            const normalized = normalizeProductImageRow(product.id, img);
            let imageUrl = normalized.image_url || '';
            if (imageUrl) {
              imageUrl = imageUrl.trim().replace(/\\/g, '/').replace(/^\/+/, '/');
              if (!imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
              }
              imageUrl = imageUrl.replace(/\/+/g, '/');
            }
            const rawThumb = normalized.thumb_url ?? null;
            return {
              ...normalized,
              image_url: imageUrl,
              thumb_url: resolveListingThumbUrl(imageUrl, rawThumb),
              thumb_url_db: rawThumb
            };
          });
        });
      }

      return {
        products: rows,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  /**
   * Attach color options to products for listing (e.g. home page).
   * Same Color group as PDP (`buildVariantDisplayModel`): CMS + variant merge, not variant-only.
   */
  public async attachColorOptionsForListing(products: any[]): Promise<void> {
    if (!products || products.length === 0) return;
    const productIds = products.map((p: any) => p.id);
    const [variantRows] = await db.query<any>(
      `SELECT id, product_id, sku, name, attributes, price, stock_quantity, is_default, track_inventory
       FROM product_variants WHERE product_id IN (?) AND is_active = TRUE ORDER BY product_id, is_default DESC, id ASC`,
      [productIds]
    );
    const byProduct = new Map<number, any[]>();
    for (const row of variantRows) {
      const pid = row.product_id as number;
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid)!.push({
        ...row,
        attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes
      });
    }
    for (const product of products) {
      const variants = byProduct.get(product.id) || [];
      product.has_variants = variants.length > 0;
      attachMultiPriceListingFieldsForProduct(product, variants);
      const pas = await ProductAttributeService.getInstance().getProductAttributes(product.id);
      product.color_options = buildColorOptionsForListing(product, variants, pas);
    }
  }

  /**
   * Get product price range based on filters
   */
  public async getProductPriceRange(filters: ProductFilters = {}): Promise<{ min: number; max: number }> {
    try {
      const {
        category_id,
        category_slug,
        search,
        is_featured,
        is_active = true,
        status = 'published',
        in_stock
      } = filters;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Build WHERE clause (must match getProducts logic)
      if (category_id) {
        whereConditions.push('p.id IN (SELECT product_id FROM product_category_relations WHERE category_id = ?)');
        queryParams.push(category_id);
      }

      if (category_slug) {
        whereConditions.push('p.id IN (SELECT pcr.product_id FROM product_category_relations pcr JOIN product_categories pc ON pcr.category_id = pc.id WHERE pc.slug = ?)');
        queryParams.push(category_slug);
      }

      // Brand filtering
      if ((filters as any).brand_id) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push((filters as any).brand_id);
      }

      if ((filters as any).brand_slug) {
        whereConditions.push('p.brand_id IN (SELECT id FROM brands WHERE slug = ?)');
        queryParams.push((filters as any).brand_slug);
      }

      if (search) {
        whereConditions.push('(MATCH(p.name, p.short_description, p.description) AGAINST(? IN BOOLEAN MODE) OR p.name LIKE ? OR p.sku LIKE ?)');
        const searchTerm = `*${search}*`;
        queryParams.push(searchTerm, `%${search}%`, `%${search}%`);
      }

      if (is_featured !== undefined) {
        whereConditions.push('p.is_featured = ?');
        queryParams.push(is_featured);
      }

      if (is_active !== undefined) {
        whereConditions.push('p.is_active = ?');
        queryParams.push(is_active);
      }

      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }

      if (in_stock) {
        whereConditions.push('(p.track_inventory = FALSE OR p.stock_quantity > 0)');
      }

      if (filters.on_sale) {
        whereConditions.push('p.is_on_sale = 1');
      }

      // Handle attribute filters
      if ((filters as any).attributes && Object.keys((filters as any).attributes).length > 0) {
        const attributeFilters = (filters as any).attributes;
        const attributeConditions: string[] = [];
        const attributeParams: any[] = [];

        // For each attribute filter
        for (const [attrSlug, valueArray] of Object.entries(attributeFilters)) {
          if (Array.isArray(valueArray) && valueArray.length > 0) {
            // Find variant_type_id by slug
             // NOTE: This requires DB calls which might be expensive inside a loop if many filters. 
             // Ideally we should optimize this but for consistency with getProducts we keep it similar structure 
             // or duplicates the logic. 
             // Since we can't easily await inside the loop and construct query synchronously without refactoring getProducts,
             // I will assume for now we can copy the logic, but the DB calls inside getProducts loop are tricky to replicate 
             // without duplicating the async logic.
             
             // To be safe and correct, I should fully replicate the async logic or refactor.
             // Given I am in the `ProductService` class, I can't easily call local vars of `getProducts`.
             // I will duplicate the async loop logic here.
             
            const [variantTypeRows] = await db.query<any>(
              'SELECT id FROM variant_types WHERE slug = ? AND is_active = TRUE',
              [attrSlug]
            );

            if (variantTypeRows.length > 0) {
              const variantTypeId = variantTypeRows[0].id; // Expecting number

              const placeholders = (valueArray as string[]).map(() => '?').join(',');
              const [valueRows] = await db.query<any>(
                `SELECT id FROM variant_type_values WHERE variant_type_id = ? AND value IN (${placeholders}) AND is_active = TRUE`,
                [variantTypeId, ...(valueArray as string[])]
              );

              if (valueRows.length > 0) {
                  const valueIds = valueRows.map((row: any) => row.id);
                  const valueChecks = valueIds.map((id: number) => {
                    return `JSON_CONTAINS(selected_values, ?)`;
                  }).join(' OR ');
                  
                  attributeConditions.push(
                    `p.id IN (
                      SELECT product_id FROM product_attributes 
                      WHERE variant_type_id = ? 
                      AND (${valueChecks})
                    )`
                  );
                  attributeParams.push(variantTypeId, ...valueIds.map((id: number) => JSON.stringify([id])));
              }
            }
          }
        }

        if (attributeConditions.length > 0) {
          whereConditions.push(`(${attributeConditions.join(' AND ')})`);
          queryParams.push(...attributeParams);
        }
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const [rows] = await db.query<any>(
        `SELECT MIN(price) as min_price, MAX(price) as max_price FROM products p ${whereClause}`,
        queryParams
      );

      return {
        min: rows[0]?.min_price || 0,
        max: rows[0]?.max_price || 0
      };

    } catch (error) {
      console.error('Error getting product price range:', error);
      return { min: 0, max: 0 };
    }
  }

  /**
   * Get featured products
   */
  public async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    try {
      const [rows] = await db.query<Product>(
        `SELECT * FROM products WHERE is_featured = TRUE AND is_active = TRUE AND status = 'published' ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );

      // Fetch images for these products
      if (rows.length > 0) {
        const productIds = rows.map(p => p.id);
        const [imageRows] = await db.query<any>(
          `SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`,
          [productIds]
        );

        // Map images to products
        rows.forEach((product: any) => {
          product.images = imageRows.filter((img: any) => img.product_id === product.id).map((img: any) => {
            const normalized = normalizeProductImageRow(product.id, img);
            let imageUrl = normalized.image_url || '';
            if (imageUrl) {
              imageUrl = imageUrl.trim().replace(/\\/g, '/').replace(/^\/+/, '/');
              if (!imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
              }
              imageUrl = imageUrl.replace(/\/+/g, '/');
            }
            const rawThumb = normalized.thumb_url ?? null;
            return {
              ...normalized,
              image_url: imageUrl,
              thumb_url: resolveListingThumbUrl(imageUrl, rawThumb),
              thumb_url_db: rawThumb
            };
          });
        });
      }

      return rows;
    } catch (error) {
      console.error('Error getting featured products:', error);
      throw error;
    }
  }

  /**
   * Get related products (same category when possible, then any active products).
   * Uses a numeric LIMIT in SQL to avoid driver placeholder issues.
   */
  public async getRelatedProducts(productId: number, categoryId: number | null, limit: number = 4): Promise<Product[]> {
    try {
      const safeLimit = Math.min(20, Math.max(1, Number(limit) || 4));
      let rows: Product[] = [];

      // Debug: count other products in DB to verify data exists
      const [countRows] = await db.query<{ total: number }>(
        'SELECT COUNT(*) as total FROM products WHERE id != ?',
        [productId]
      );
      const totalOtherProducts = Number(Array.isArray(countRows) && countRows[0] ? (countRows[0] as any).total : 0);
      const [activeCountRows] = await db.query<{ total: number }>(
        "SELECT COUNT(*) as total FROM products WHERE id != ? AND is_active = 1 AND status = 'published'",
        [productId]
      );
      const activeOtherProducts = Number(Array.isArray(activeCountRows) && activeCountRows[0] ? (activeCountRows[0] as any).total : 0);
      console.log('[getRelatedProducts] productId=%s categoryId=%s totalOther=%s activePublished=%s', productId, categoryId, totalOtherProducts, activeOtherProducts);

      // 1) Try products that share a category (product_category_relations or same category_id)
      const [categoryIdRows] = await db.query<{ category_id: number }>(
        'SELECT category_id FROM product_category_relations WHERE product_id = ?',
        [productId]
      );
      const categoryIds = categoryIdRows.map(r => r.category_id);
      if (categoryId != null) categoryIds.push(categoryId);
      const uniqueCategoryIds = [...new Set(categoryIds)].filter((id): id is number => id != null && id > 0);

      if (uniqueCategoryIds.length > 0) {
        const [relatedByCategory] = await db.query<Product>(
          `SELECT DISTINCT p.* FROM products p
           LEFT JOIN product_category_relations pcr ON pcr.product_id = p.id AND pcr.category_id IN (?)
           WHERE p.id != ? AND p.is_active = TRUE AND p.status = 'published'
           AND (p.category_id IN (?) OR pcr.category_id IS NOT NULL)
           ORDER BY RAND()
           LIMIT ${safeLimit}`,
          [uniqueCategoryIds, productId, uniqueCategoryIds]
        );
        rows = Array.isArray(relatedByCategory) ? relatedByCategory : [];
        console.log('[getRelatedProducts] by category rows=%s', rows.length);
      }

      // 2) If none found by category, get any other active products
      if (rows.length === 0) {
        const [anyProducts] = await db.query<Product>(
          `SELECT * FROM products WHERE id != ? AND is_active = 1 AND status = 'published' ORDER BY RAND() LIMIT ${safeLimit}`,
          [productId]
        );
        rows = Array.isArray(anyProducts) ? anyProducts : [];
        console.log('[getRelatedProducts] fallback any products rows=%s', rows.length);
      }

      // Fetch images for related products
      if (rows.length > 0) {
        const productIds = rows.map(p => p.id);
        const [imageRows] = await db.query<any>(
          `SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`,
          [productIds]
        );

        // Map images to products
        rows.forEach((product: any) => {
          product.images = imageRows.filter((img: any) => img.product_id === product.id).map((img: any) => {
            const normalized = normalizeProductImageRow(product.id, img);
            let imageUrl = normalized.image_url || '';
            if (imageUrl) {
              imageUrl = imageUrl.trim().replace(/\\/g, '/').replace(/^\/+/, '/');
              if (!imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
              }
              imageUrl = imageUrl.replace(/\/+/g, '/');
            }
            const rawThumb = normalized.thumb_url ?? null;
            return {
              ...normalized,
              image_url: imageUrl,
              thumb_url: resolveListingThumbUrl(imageUrl, rawThumb),
              thumb_url_db: rawThumb
            };
          });
        });
      }

      return rows;
    } catch (error) {
      console.error('Error getting related products:', error);
      throw error;
    }
  }

  /**
   * Increment product view count
   */
  public async incrementViewCount(productId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
        [productId]
      );
    } catch (error) {
      console.error('Error incrementing view count:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Check if product is in stock
   */
  public async isInStock(productId: number, variantId?: number, quantity: number = 1): Promise<boolean> {
    try {
      if (variantId) {
        const [rows] = await db.query<any>(
          'SELECT stock_quantity, track_inventory FROM product_variants WHERE id = ? AND is_active = TRUE',
          [variantId]
        );
        if (rows.length === 0) return false;
        const variant = rows[0];
        return !variant.track_inventory || variant.stock_quantity >= quantity;
      } else {
        const [rows] = await db.query<any>(
          'SELECT stock_quantity, track_inventory FROM products WHERE id = ?',
          [productId]
        );
        if (rows.length === 0) return false;
        const product = rows[0];
        return !product.track_inventory || product.stock_quantity >= quantity;
      }
    } catch (error) {
      console.error('Error checking stock:', error);
      return false;
    }
  }

  /**
   * Get product price (considering variant override)
   */
  public async getProductPrice(productId: number, variantId?: number): Promise<number> {
    try {
      const toNum = (v: unknown): number => {
        if (v === null || v === undefined || v === '') return NaN;
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : NaN;
      };

      if (variantId) {
        const [rows] = await db.query<any>(
          `SELECT v.price AS variant_price, p.price AS product_price
           FROM product_variants v
           INNER JOIN products p ON p.id = v.product_id
           WHERE v.id = ? AND v.product_id = ? AND v.is_active = TRUE`,
          [variantId, productId]
        );
        if (rows.length > 0) {
          const vp = toNum(rows[0].variant_price);
          if (!Number.isNaN(vp)) {
            return vp;
          }
          const pp = toNum(rows[0].product_price);
          if (!Number.isNaN(pp)) {
            return pp;
          }
        }
      }

      const [rows] = await db.query<any>(
        'SELECT price FROM products WHERE id = ?',
        [productId]
      );
      const p = rows.length > 0 ? toNum(rows[0].price) : NaN;
      return Number.isNaN(p) ? 0 : p;
    } catch (error) {
      console.error('Error getting product price:', error);
      return 0;
    }
  }
}

export default ProductService.getInstance();

