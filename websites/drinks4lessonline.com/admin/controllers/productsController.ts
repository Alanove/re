import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { ProductManagementService } from '../services/productManagementService';
import { CategoryManagementService } from '../services/categoryManagementService';
import { ProductAttributeService } from '../services/productAttributeService';
import { BrandManagementService } from '../services/brandManagementService';
import { i18nService } from '../services/i18nService';
import { StorageService } from '../services/storageService';
import { requireAdminAccess } from '../utils/roleMiddleware';
import { db } from '../../src/config/database';
import { getPublicUrl, DATA_PATHS, getProductImagesDirPath } from '../../src/constants/data-paths';
import {
  generateThumbForPublicUrl,
  deleteThumbFileForSourceImageUrl,
} from '../../src/services/imageThumbService';
import { normalizeProductImages } from '../../src/services/productImageUrlService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const productService = ProductManagementService.getInstance();
const productManagementService = ProductManagementService.getInstance();
const categoryService = CategoryManagementService.getInstance();
const productAttributeService = ProductAttributeService.getInstance();
const brandService = BrandManagementService.getInstance();
const storageService = StorageService.getInstance();

/**
 * Physically delete an image file only when no other product_images row
 * still references the same URL.  Pass excludeId to skip the row you are
 * about to delete (so its own reference doesn't block the file removal).
 */
async function safeDeleteImageFile(
  imageUrl: string,
  excludeProductImageId?: number
): Promise<void> {
  if (!imageUrl) return;

  const whereClause = excludeProductImageId != null
    ? 'WHERE image_url = ? AND id != ?'
    : 'WHERE image_url = ?';
  const params: unknown[] = excludeProductImageId != null
    ? [imageUrl, excludeProductImageId]
    : [imageUrl];

  const [refs] = await db.query<any>(
    `SELECT COUNT(*) AS cnt FROM product_images ${whereClause}`,
    params
  );

  if ((refs[0].cnt as number) > 0) {
    // Another product_images row still uses this file — only delete the thumb
    deleteThumbFileForSourceImageUrl(imageUrl);
    return;
  }

  // Safe to remove both the thumb and the source file
  deleteThumbFileForSourceImageUrl(imageUrl);
  const pathOnDisk = imageUrl.startsWith('/')
    ? DATA_PATHS.PUBLIC_DIR + imageUrl
    : DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
  storageService.deleteFile(pathOnDisk);
}

/** Slugify attribute fragments for variant SKUs (alphanumeric + hyphens). */
function slugifySkuPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'x';
}

function buildVariantSkuFromAttributes(
  baseSku: string,
  attributes: Record<string, unknown>,
  skuCodeByAttribute?: Record<string, string>
): string {
  const keys = Object.keys(attributes).sort((a, b) => a.localeCompare(b));
  const parts = keys.map(k => {
    const code = skuCodeByAttribute?.[k]?.trim();
    return slugifySkuPart(code || String((attributes as Record<string, string>)[k] ?? ''));
  });
  const base = slugifySkuPart(baseSku || 'p');
  const joined = [base, ...parts].filter(Boolean).join('-');
  return joined.slice(0, 120).toUpperCase();
}

async function loadVariantValueSkuCodes(
  valueIds: number[]
): Promise<Map<number, { attributeName: string; skuCode: string | null }>> {
  const map = new Map<number, { attributeName: string; skuCode: string | null }>();
  const ids = [...new Set(valueIds.filter((id) => Number.isFinite(id)))];
  if (!ids.length) return map;

  try {
    const [rows] = await db.query<any>(
      `SELECT vtv.id, vt.name AS attribute_name, vtv.sku_code
       FROM variant_type_values vtv
       JOIN variant_types vt ON vt.id = vtv.variant_type_id
       WHERE vtv.id IN (?)`,
      [ids]
    );
    for (const row of rows) {
      const code = row.sku_code != null ? String(row.sku_code).trim() : '';
      map.set(Number(row.id), {
        attributeName: String(row.attribute_name || ''),
        skuCode: code || null
      });
    }
  } catch (error: any) {
    if (error?.errno !== 1054) throw error;
  }
  return map;
}

function allocateUniqueSku(candidate: string, used: Set<string>): string {
  const normalized = candidate.slice(0, 120).toUpperCase();
  let c = normalized;
  if (!used.has(c)) {
    used.add(c);
    return c;
  }
  let n = 2;
  while (n < 100000) {
    const suffix = `-${n}`;
    const maxBase = Math.max(0, 120 - suffix.length);
    const trial = `${normalized.slice(0, maxBase)}${suffix}`;
    if (!used.has(trial)) {
      used.add(trial);
      return trial;
    }
    n++;
  }
  const fallback = `${normalized.slice(0, 80)}-${Date.now().toString(36).toUpperCase()}`;
  used.add(fallback);
  return fallback;
}

export class ProductsController {
  /**
   * Products list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const category_id = req.query.category_id ? parseInt(req.query.category_id as string) : undefined;
      const statusQuery = typeof req.query.status === 'string' ? req.query.status : '';
      let status: string | undefined;
      let is_featured: boolean | undefined;
      let is_on_sale: boolean | undefined;
      if (statusQuery === 'featured') {
        is_featured = true;
      } else if (statusQuery === 'on_sale') {
        is_on_sale = true;
      } else if (statusQuery) {
        status = statusQuery;
      }

      const filters: { search?: string; category_id?: number; status?: string; is_featured?: boolean; is_on_sale?: boolean } = {};
      if (search) filters.search = search;
      if (category_id !== undefined) filters.category_id = category_id;
      if (status) filters.status = status;
      if (is_featured !== undefined) filters.is_featured = is_featured;
      if (is_on_sale !== undefined) filters.is_on_sale = is_on_sale;

      const result = await productService.getAllProducts(page, limit, filters);

      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      // Use translation function from middleware (res.locals.t) which respects session language
      const t = (res.locals as any).t || ((key: string) => key);

      res.render('products/products', {
        title: 'Products',
        pageTitle: t('ecommerce.products.title'),
        siteTitle,
        // t is already in res.locals, no need to pass it explicitly
        products: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        categories,
        filters: { search, category_id, status: statusQuery || undefined }
      });
    } catch (error) {
      console.error('Error rendering products page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create product page
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const siteTitle = await siteSettingsService.getSiteTitle();
      const categories = await categoryService.getAllCategories(true);
      const brands = await brandService.getAllBrands(true);
      const variantTypes = await productAttributeService.getAllProductAttributes();
      const t = (res.locals as any).t || ((key: string) => key);

      res.render('products/create-product', {
        title: t('ecommerce.products.createProduct'),
        pageTitle: t('ecommerce.products.createProduct'),
        siteTitle,
        categories,
        brands,
        variantTypes,
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering create product page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create product (POST)
   */
  public static async createPost(req: Request, res: Response): Promise<void> {
    try {
      const productData: any = {
        name: req.body.name,
        slug: req.body.slug || req.body.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-'),
        price: parseFloat(req.body.price),
        stock_quantity: parseInt(req.body.stock_quantity) || 0,
        low_stock_threshold: req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : 5,
        is_featured: req.body.is_featured === 'true' || req.body.is_featured === 'on',
        is_on_sale: req.body.is_on_sale === 'true' || req.body.is_on_sale === 'on',
        is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off',
        include_in_auto_ads:
          req.body.include_in_auto_ads !== 'false' && req.body.include_in_auto_ads !== 'off',
        status: req.body.status || 'draft'
      };

      if (req.body.sku) productData.sku = req.body.sku;
      productData.brand_id = req.body.brand_id ? parseInt(req.body.brand_id, 10) : null;
      if (req.body.short_description) productData.short_description = req.body.short_description;
      if (req.body.description) productData.description = req.body.description;
      if (req.body.compare_at_price) productData.compare_at_price = parseFloat(req.body.compare_at_price);
      if (req.body.weight) productData.weight = parseFloat(req.body.weight);
      if (req.body.length) productData.length = parseFloat(req.body.length);
      if (req.body.width) productData.width = parseFloat(req.body.width);
      if (req.body.height) productData.height = parseFloat(req.body.height);
      
      if (req.body.category_ids) {
        productData.category_ids = Array.isArray(req.body.category_ids) 
          ? req.body.category_ids.map((id: string) => parseInt(id)) 
          : [parseInt(req.body.category_ids)];
      } else if (req.body.category_id) {
        productData.category_ids = [parseInt(req.body.category_id)];
      }

      if (req.body.meta_title) productData.meta_title = req.body.meta_title;
      if (req.body.meta_description) productData.meta_description = req.body.meta_description;
      if (req.body.meta_keywords) productData.meta_keywords = req.body.meta_keywords;

      const product = await productService.createProduct(productData);

      // Handle image upload if provided (move from staging into product folder)
      if (req.file) {
        const productDir = getProductImagesDirPath(product.id);
        if (!fs.existsSync(productDir)) {
          fs.mkdirSync(productDir, { recursive: true });
        }
        const destPath = path.join(productDir, path.basename(req.file.path));
        storageService.moveFile(req.file.path, destPath);

        const imageUrl = getPublicUrl(destPath);
        const thumbUrl = await generateThumbForPublicUrl(imageUrl);
        await productService.addProductImage(
          product.id,
          null,
          imageUrl,
          undefined,
          true,
          0,
          thumbUrl
        );
      }

      // Handle variants if provided
      if (req.body.variants) {
        try {
          const variants = typeof req.body.variants === 'string'
            ? JSON.parse(req.body.variants)
            : req.body.variants;

          if (Array.isArray(variants)) {
            for (const variantData of variants) {
              await productManagementService.addProductVariant({
                product_id: product.id,
                name: variantData.name,
                sku: variantData.sku || null,
                price: variantData.price || null,
                stock_quantity: variantData.stock_quantity || 0,
                weight: variantData.weight || null,
                attributes: variantData.attributes || {},
                has_image: variantData.has_image || false
              });
            }
          }
        } catch (error) {
          console.error('Error creating variants:', error);
          // Don't fail product creation if variant creation fails
        }
      }

      res.redirect(`/admin/products/${product.id}/edit?success=Product created successfully`);
    } catch (error: any) {
      console.error('Error creating product:', error);
      res.redirect(`/admin/products/create?error=${encodeURIComponent(error.message || 'Failed to create product')}`);
    }
  }

  /**
   * Edit product page
   */
  public static async edit(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const product = await productService.getProductById(productId);

      if (!product) {
        res.status(404).render('admin/error', { error: 'Product not found' });
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const categories = await categoryService.getAllCategories(true);
      const brands = await brandService.getAllBrands(true);
      const variantTypes = await productAttributeService.getAllProductAttributes();
      const t = (res.locals as any).t || ((key: string) => key);

      // Get variants and images
      const [variants] = await db.query<any>(
        'SELECT * FROM product_variants WHERE product_id = ?',
        [productId]
      );

      const [images] = await db.query<any>(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC',
        [productId]
      );

      res.render('products/edit-product', {
        title: `Edit Product - ${product.name}`,
        pageTitle: t('ecommerce.products.editProduct'),
        siteTitle,
        product,
        categories,
        brands,
        variantTypes,
        variants: variants.map(v => ({ ...v, attributes: JSON.parse(v.attributes) })),
        images: normalizeProductImages(productId, images),
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering edit product page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update product (POST)
   */
  public static async editPost(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const productData: any = {};

      if (req.body.name) productData.name = req.body.name;
      if (req.body.slug) productData.slug = req.body.slug;
      if (req.body.sku !== undefined) productData.sku = req.body.sku || null;
      if (req.body.short_description !== undefined) productData.short_description = req.body.short_description || null;
      if (req.body.description !== undefined) productData.description = req.body.description || null;
      if (req.body.price) productData.price = parseFloat(req.body.price);
      if (req.body.compare_at_price !== undefined) productData.compare_at_price = req.body.compare_at_price ? parseFloat(req.body.compare_at_price) : null;
      if (req.body.stock_quantity !== undefined) productData.stock_quantity = parseInt(req.body.stock_quantity) || 0;
      if (req.body.low_stock_threshold !== undefined) productData.low_stock_threshold = req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : 5;
      if (req.body.weight !== undefined) productData.weight = req.body.weight ? parseFloat(req.body.weight) : null;
      if (req.body.length !== undefined) productData.length = req.body.length ? parseFloat(req.body.length) : null;
      if (req.body.width !== undefined) productData.width = req.body.width ? parseFloat(req.body.width) : null;
      if (req.body.height !== undefined) productData.height = req.body.height ? parseFloat(req.body.height) : null;
      // Checkboxes: unchecked = not sent, so always set from body (absent => false)
      productData.is_featured = req.body.is_featured === 'true' || req.body.is_featured === 'on';
      productData.is_on_sale = req.body.is_on_sale === 'true' || req.body.is_on_sale === 'on';
      productData.is_active = req.body.is_active === 'true' || req.body.is_active === 'on';
      productData.include_in_auto_ads =
        req.body.include_in_auto_ads === 'true' || req.body.include_in_auto_ads === 'on';
      if (req.body.status) productData.status = req.body.status;
      if (req.body.category_ids !== undefined) {
        productData.category_ids = Array.isArray(req.body.category_ids)
          ? req.body.category_ids.map((id: string) => parseInt(id))
          : [parseInt(req.body.category_ids)];
      } else if (req.body.category_id !== undefined) {
        productData.category_ids = req.body.category_id ? [parseInt(req.body.category_id)] : [];
      }
      productData.brand_id = req.body.brand_id ? parseInt(req.body.brand_id, 10) : null;
      if (req.body.meta_title !== undefined) productData.meta_title = req.body.meta_title || null;
      if (req.body.meta_description !== undefined) productData.meta_description = req.body.meta_description || null;
      if (req.body.meta_keywords !== undefined) productData.meta_keywords = req.body.meta_keywords || null;

      await productService.updateProduct(productId, productData);

      res.redirect(`/admin/products/${productId}/edit?success=Product updated successfully`);
    } catch (error: any) {
      console.error('Error updating product:', error);
      res.redirect(`/admin/products/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update product')}`);
    }
  }

  /**
   * Delete product
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      await productService.deleteProduct(productId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      const isConstraintError = error.message?.includes('referenced by existing orders') ||
        error.code === 'ER_ROW_IS_REFERENCED_2';
      res.status(isConstraintError ? 409 : 500).json({
        success: false,
        message: isConstraintError
          ? 'This product has been purchased and cannot be deleted. You can deactivate it instead.'
          : 'Failed to delete product'
      });
    }
  }

  /**
   * Upload product image(s) - supports single or multiple files
   */
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === 'on';
      const altText = req.body.alt_text || null;

      // Handle both single file and multiple files
      let files: Express.Multer.File[] = [];
      if (req.files) {
        // req.files is an array when using .array()
        files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      } else if (req.file) {
        files = [req.file];
      }

      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files uploaded' });
        return;
      }

      // Get current max order_index for this product
      const [orderRows] = await db.query<any>(
        'SELECT MAX(order_index) as max_order FROM product_images WHERE product_id = ?',
        [productId]
      );
      let orderIndex = (orderRows[0]?.max_order || -1) + 1;

      const uploadedImages: any[] = [];

      // Process each uploaded file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Convert absolute path to public URL
        const imageUrl = getPublicUrl(file.path);
        const thumbUrl = await generateThumbForPublicUrl(imageUrl);

        // Set first image as primary if isPrimary is true, or if it's the first image and no primary exists
        const setAsPrimary = isPrimary && i === 0;

        // Add image to database
        const imageId = await productService.addProductImage(
          productId,
          null, // variant_id
          imageUrl,
          altText || undefined, // use undefined if null
          setAsPrimary,
          orderIndex,
          thumbUrl
        );

        uploadedImages.push({
          id: imageId,
          image_url: imageUrl,
          alt_text: altText,
          is_primary: setAsPrimary,
          order_index: orderIndex
        });

        orderIndex++;
      }

      res.json({
        success: true,
        images: uploadedImages,
        count: uploadedImages.length
      });
    } catch (error: any) {
      console.error('Error uploading product images:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to upload images' });
    }
  }

  /**
   * Delete product image
   */
  public static async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const imageId = parseInt(req.params.imageId);
      const productId = parseInt(req.params.id);

      // Get image info before deleting
      const [imageRows] = await db.query<any>(
        'SELECT image_url, is_primary, product_id FROM product_images WHERE id = ?',
        [imageId]
      );

      if (imageRows.length === 0) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }

      const wasPrimary = imageRows[0].is_primary;

      // Delete from database
      await productService.deleteProductImage(imageId);

      // Delete file if it exists
      const imageUrl = imageRows[0].image_url;
      if (imageUrl) {
        deleteThumbFileForSourceImageUrl(imageUrl);
        const imagePath = imageUrl.startsWith('/')
          ? DATA_PATHS.PUBLIC_DIR + imageUrl
          : DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
        storageService.deleteFile(imagePath);
      }

      // If the deleted image was primary, set the first remaining image as primary
      if (wasPrimary) {
        const [remainingImages] = await db.query<any>(
          'SELECT id FROM product_images WHERE product_id = ? ORDER BY id ASC LIMIT 1',
          [productId]
        );

        if (remainingImages.length > 0) {
          await productService.setPrimaryImage(productId, remainingImages[0].id);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting product image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete image' });
    }
  }

  /**
   * Copy a product and open the new edit page.
   */
  public static async copy(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id, 10);
      if (Number.isNaN(productId) || productId < 1) {
        res.status(400).json({ success: false, error: 'Invalid product' });
        return;
      }

      const newId = await productManagementService.duplicateProduct(productId);
      res.json({ success: true, id: newId, redirect: `/admin/products/${newId}/edit` });
    } catch (error: any) {
      console.error('Error copying product:', error);
      const status = error.message === 'Product not found' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message || 'Failed to copy product' });
    }
  }

  /**
   * Set primary image
   */
  public static async setPrimaryImage(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const imageId = parseInt(req.body.image_id);

      await productService.setPrimaryImage(productId, imageId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error setting primary image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to set primary image' });
    }
  }

  /**
   * Save the gallery order after a drag-and-drop.
   */
  public static async reorderImage(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id, 10);
      const rawIds = Array.isArray(req.body.image_ids) ? req.body.image_ids : [];
      const imageIds = rawIds
        .map((id: unknown) => parseInt(String(id), 10))
        .filter((id: number) => !Number.isNaN(id));

      if (Number.isNaN(productId) || imageIds.length === 0) {
        res.status(400).json({ success: false, error: 'Invalid image reorder request' });
        return;
      }

      await productService.reorderProductImages(productId, imageIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error reordering product image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to reorder image' });
    }
  }

  /**
   * Get product images
   */
  public static async getImages(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const images = normalizeProductImages(productId, await productService.getProductImages(productId));

      res.json({ success: true, images });
    } catch (error: any) {
      console.error('Error getting product images:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get images' });
    }
  }

  /**
   * Create product variant
   */
  public static async createVariant(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      let { name, sku, price, stock_quantity, weight, attributes } = req.body;

      if (typeof attributes === 'string') {
        try {
          attributes = JSON.parse(attributes);
        } catch (e) {
          attributes = {};
        }
      }

      if (!name) {
        res.status(400).json({ success: false, error: 'Variant name is required' });
        return;
      }

      const variantId = await productManagementService.addProductVariant({
        product_id: productId,
        name,
        attributes: attributes || {},
        has_image: !!req.file,
        stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
        ...(sku && String(sku).trim() ? { sku: String(sku).trim().toUpperCase() } : {}),
        ...(price ? { price: parseFloat(price) } : {}),
        ...(weight ? { weight: parseFloat(weight) } : {})
      });

      if (req.file) {
        const imageUrl = getPublicUrl(req.file.path);
        const thumbUrl = await generateThumbForPublicUrl(imageUrl);
        await productService.addProductImage(
          productId,
          variantId,
          imageUrl,
          undefined,
          false,
          0,
          thumbUrl
        );
      }

      res.json({ success: true, variant_id: variantId });
    } catch (error: any) {
      console.error('Error creating variant:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create variant' });
    }
  }

  /**
   * Update product variant
   */
  public static async updateVariant(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const variantId = parseInt(req.params.variantId);
      const body = req.body as Record<string, any>;
      let { name, sku, price, stock_quantity, weight, attributes } = body;

      if (typeof attributes === 'string') {
        try {
          attributes = JSON.parse(attributes);
        } catch (e) {
          attributes = {};
        }
      }

      const updateData: Partial<any> = {};

      if ('name' in body) updateData.name = name;
      if ('stock_quantity' in body) {
        const v = body.stock_quantity;
        updateData.stock_quantity =
          v === '' || v === null || v === undefined ? 0 : parseInt(String(v), 10) || 0;
      }
      if ('sku' in body) {
        updateData.sku =
          sku === '' || sku === null || sku === undefined ? null : String(sku).trim().toUpperCase();
      }
      if ('price' in body) {
        const p = body.price;
        updateData.price = p === '' || p === null || p === undefined ? null : parseFloat(String(p));
      }
      if ('weight' in body) {
        const w = body.weight;
        updateData.weight = w === '' || w === null || w === undefined ? null : parseFloat(String(w));
      }
      if ('attributes' in body) {
        updateData.attributes = attributes || {};
      }

      await productManagementService.updateProductVariant(variantId, updateData);

      if (req.file) {
        const imageUrl = getPublicUrl(req.file.path);
        await productService.addProductImage(
          productId,
          variantId,
          imageUrl,
          undefined,
          false,
          0
        );
        await productManagementService.updateProductVariant(variantId, {
          has_image: true
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating variant:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update variant' });
    }
  }

  /**
   * Delete product variant
   */
  public static async deleteVariant(req: Request, res: Response): Promise<void> {
    try {
      const variantId = parseInt(req.params.variantId);
      await productManagementService.deleteProductVariant(variantId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting variant:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete variant' });
    }
  }

  /**
   * Upload variant image
   */
  public static async uploadVariantImage(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      let variantId: number | null = null;

      // Handle variantId parameter - could be "new-X" or actual ID
      const variantIdParam = req.params.variantId;
      if (variantIdParam && !variantIdParam.startsWith('new-')) {
        variantId = parseInt(variantIdParam);
      }

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const imageUrl = getPublicUrl(req.file.path);
      const thumbUrl = await generateThumbForPublicUrl(imageUrl);

      // If variantId is null (new variant), we need to create the variant first or store image temporarily
      // For now, we'll require the variant to be saved first
      if (!variantId || isNaN(variantId)) {
        res.status(400).json({ success: false, error: 'Variant must be saved before uploading image. Please save the variant first, then upload the image.' });
        return;
      }

      const imageId = await productService.addProductImage(
        productId,
        null, // variant_id
        imageUrl,
        undefined, // alt_text
        false, // is_primary
        0, // order_index
        thumbUrl
      );

      res.json({ success: true, image_id: imageId, image_url: imageUrl });
    } catch (error: any) {
      console.error('Error uploading variant image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to upload variant image' });
    }
  }

  /**
   * Delete variant image
   */
  public static async deleteVariantImage(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const variantId = parseInt(req.params.variantId);
      const imageId = parseInt(req.params.imageId);

      // Verify image belongs to this variant
      const [imageRows] = await db.query<any>(
        'SELECT image_url FROM product_images WHERE id = ? AND variant_id = ? AND product_id = ?',
        [imageId, variantId, productId]
      );

      if (imageRows.length === 0) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }

      // Delete from database
      await productService.deleteProductImage(imageId);

      // Delete file if it exists
      const imageUrl = imageRows[0].image_url;
      if (imageUrl) {
        deleteThumbFileForSourceImageUrl(imageUrl);
        const imagePath = imageUrl.startsWith('/')
          ? DATA_PATHS.PUBLIC_DIR + imageUrl
          : DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
        storageService.deleteFile(imagePath);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting variant image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete variant image' });
    }
  }

  /**
   * Get product attributes (for edit page)
   */
  public static async getProductAttributes(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const attributes = await productAttributeService.getProductAttributes(productId);

      res.json({ success: true, attributes });
    } catch (error: any) {
      console.error('Error getting product attributes:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get product attributes' });
    }
  }

  /**
   * Add attribute to product
   */
  public static async addProductAttribute(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const { variant_type_id } = req.body;

      if (!variant_type_id) {
        res.status(400).json({ success: false, error: 'variant_type_id is required' });
        return;
      }

      await productAttributeService.addProductAttribute(productId, parseInt(variant_type_id));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error adding product attribute:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to add product attribute' });
    }
  }

  /**
   * Remove attribute from product
   */
  public static async removeProductAttribute(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const attributeId = parseInt(req.params.attributeId);

      await productAttributeService.removeProductAttribute(productId, attributeId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing product attribute:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to remove product attribute' });
    }
  }

  /**
   * Update attribute selection
   */
  public static async updateAttributeSelection(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const attributeId = parseInt(req.params.attributeId);
      const { selected_values } = req.body;

      if (!Array.isArray(selected_values)) {
        res.status(400).json({ success: false, error: 'selected_values must be an array' });
        return;
      }

      await productAttributeService.updateProductAttributeSelection(productId, attributeId, selected_values);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating attribute selection:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update attribute selection' });
    }
  }

  /**
   * Upload attribute value image for a specific product (stored in product_images).
   */
  public static async uploadAttributeValueImage(req: Request, res: Response): Promise<void> {
    try {
      const valueId = parseInt(req.params.valueId, 10);
      const productIdRaw = req.query.productId;
      const productId =
        productIdRaw !== undefined && productIdRaw !== '' ? parseInt(String(productIdRaw), 10) : NaN;

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      if (Number.isNaN(productId)) {
        res.status(400).json({ success: false, error: 'productId is required' });
        return;
      }

      const imageUrl = getPublicUrl(req.file.path);
      const thumbUrl = await generateThumbForPublicUrl(imageUrl);

      const [piRows] = await db.query<any>(
        'SELECT id, image_url FROM product_images WHERE product_id = ? AND attribute_value_id = ?',
        [productId, valueId]
      );
      for (const row of piRows) {
        if (row.image_url) {
          await safeDeleteImageFile(row.image_url, row.id);
        }
      }

      await productAttributeService.uploadProductAttributeValueImage(
        productId,
        valueId,
        imageUrl,
        thumbUrl
      );

      // Remove mistaken global image so other products do not inherit it
      const prevGlobalUrl = await productAttributeService.clearAttributeValueGlobalImage(valueId);
      if (prevGlobalUrl && prevGlobalUrl !== imageUrl) {
        await safeDeleteImageFile(prevGlobalUrl);
      }

      res.json({ success: true, image_url: imageUrl, thumb_url: thumbUrl });
    } catch (error: any) {
      console.error('Error uploading attribute value image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to upload attribute value image' });
    }
  }

  /**
   * Delete attribute value image for a specific product (removes from product_images).
   */
  public static async deleteAttributeValueImage(req: Request, res: Response): Promise<void> {
    try {
      const valueId = parseInt(req.params.valueId, 10);
      const productIdRaw = req.query.productId;
      const productId =
        productIdRaw !== undefined && productIdRaw !== ''
          ? parseInt(String(productIdRaw), 10)
          : NaN;

      if (!Number.isNaN(productId)) {
        const [piRows] = await db.query<any>(
          'SELECT id, image_url FROM product_images WHERE product_id = ? AND attribute_value_id = ?',
          [productId, valueId]
        );
        for (const row of piRows) {
          if (row.image_url) {
            await safeDeleteImageFile(row.image_url, row.id);
          }
        }
        await productAttributeService.deleteProductAttributeValueImage(productId, valueId);
      } else {
        res.status(400).json({ success: false, error: 'productId is required' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting attribute value image:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete attribute value image' });
    }
  }

  /**
   * Set every variant's stock_quantity to the same value (product edit helper).
   */
  public static async resetAllVariantStocks(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id, 10);
      const raw = (req.body as { stock_quantity?: unknown; stock?: unknown }).stock_quantity ?? req.body.stock;
      const n = parseInt(String(raw ?? ''), 10);

      if (Number.isNaN(productId) || productId < 1) {
        res.status(400).json({ success: false, error: 'Invalid product' });
        return;
      }
      if (Number.isNaN(n) || n < 0) {
        res.status(400).json({ success: false, error: 'Enter a valid stock quantity (0 or greater)' });
        return;
      }

      const [result] = await db.query<any>(
        'UPDATE product_variants SET stock_quantity = ?, updated_at = NOW() WHERE product_id = ?',
        [n, productId]
      );
      const affected = (result as { affectedRows?: number }).affectedRows ?? 0;

      res.json({ success: true, updated: affected, stock_quantity: n });
    } catch (error: any) {
      console.error('Error resetting variant stocks:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update stocks' });
    }
  }

  /**
   * Bulk create variants from attribute combinations
   */
  public static async createBulkVariants(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id);
      const { variants } = req.body;

      if (!variants || !Array.isArray(variants)) {
        res.status(400).json({ success: false, error: 'variants array is required' });
        return;
      }

      const [productRows] = await db.query<any>('SELECT id, sku FROM products WHERE id = ?', [productId]);
      const productSku =
        productRows.length > 0 && productRows[0].sku && String(productRows[0].sku).trim()
          ? String(productRows[0].sku).trim().toUpperCase()
          : `P${productId}`;

      const [existingSkuRows] = await db.query<any>(
        "SELECT sku FROM product_variants WHERE product_id = ? AND sku IS NOT NULL AND TRIM(sku) <> ''",
        [productId]
      );
      const usedSkus = new Set<string>(
        existingSkuRows
          .map((r: { sku: string }) => r.sku)
          .filter(Boolean)
          .map((s: string) => s.toUpperCase())
      );

      const valueIds: number[] = [];
      for (const variant of variants) {
        const entries = Array.isArray(variant?.valueIds) ? variant.valueIds : [];
        for (const entry of entries) {
          const id = typeof entry === 'object' && entry ? parseInt(entry.id, 10) : parseInt(entry, 10);
          if (!Number.isNaN(id)) valueIds.push(id);
        }
      }
      const skuCodes = await loadVariantValueSkuCodes(valueIds);

      const variantsData = variants.map((v: any) => {
        const attrs = (v.attributes && typeof v.attributes === 'object' ? v.attributes : {}) as Record<
          string,
          unknown
        >;
        const skuCodeByAttribute: Record<string, string> = {};
        const entries = Array.isArray(v.valueIds) ? v.valueIds : [];
        for (const entry of entries) {
          const id = typeof entry === 'object' && entry ? parseInt(entry.id, 10) : parseInt(entry, 10);
          const meta = skuCodes.get(id);
          if (!meta?.skuCode) continue;
          const attributeName = typeof entry === 'object' && entry?.attribute
            ? String(entry.attribute)
            : meta.attributeName;
          if (attributeName) skuCodeByAttribute[attributeName] = meta.skuCode;
        }
        let sku: string | null =
          v.sku && String(v.sku).trim() ? String(v.sku).trim().toUpperCase() : null;
        if (!sku) {
          const candidate = buildVariantSkuFromAttributes(productSku, attrs, skuCodeByAttribute);
          sku = allocateUniqueSku(candidate, usedSkus);
        } else if (usedSkus.has(sku)) {
          sku = allocateUniqueSku(sku, usedSkus);
        } else {
          usedSkus.add(sku);
        }

        return {
          product_id: productId,
          name: v.name,
          sku,
          price: v.price || null,
          stock_quantity: v.stock_quantity || 0,
          weight: v.weight || null,
          attributes: attrs,
          has_image: false // Generated variants don't have individual images
        };
      });

      await productManagementService.createProductVariantsBulk(variantsData);

      res.json({ success: true, count: variantsData.length });
    } catch (error: any) {
      console.error('Error creating bulk variants:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create variants' });
    }
  }

}

