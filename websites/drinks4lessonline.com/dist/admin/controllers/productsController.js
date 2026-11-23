"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const productManagementService_1 = require("../services/productManagementService");
const categoryManagementService_1 = require("../services/categoryManagementService");
const productAttributeService_1 = require("../services/productAttributeService");
const brandManagementService_1 = require("../services/brandManagementService");
const storageService_1 = require("../services/storageService");
const database_1 = require("../../src/config/database");
const data_paths_1 = require("../../src/constants/data-paths");
const imageThumbService_1 = require("../../src/services/imageThumbService");
const productImageUrlService_1 = require("../../src/services/productImageUrlService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const productService = productManagementService_1.ProductManagementService.getInstance();
const productManagementService = productManagementService_1.ProductManagementService.getInstance();
const categoryService = categoryManagementService_1.CategoryManagementService.getInstance();
const productAttributeService = productAttributeService_1.ProductAttributeService.getInstance();
const brandService = brandManagementService_1.BrandManagementService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
async function safeDeleteImageFile(imageUrl, excludeProductImageId) {
    if (!imageUrl)
        return;
    const whereClause = excludeProductImageId != null
        ? 'WHERE image_url = ? AND id != ?'
        : 'WHERE image_url = ?';
    const params = excludeProductImageId != null
        ? [imageUrl, excludeProductImageId]
        : [imageUrl];
    const [refs] = await database_1.db.query(`SELECT COUNT(*) AS cnt FROM product_images ${whereClause}`, params);
    if (refs[0].cnt > 0) {
        (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(imageUrl);
        return;
    }
    (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(imageUrl);
    const pathOnDisk = imageUrl.startsWith('/')
        ? data_paths_1.DATA_PATHS.PUBLIC_DIR + imageUrl
        : data_paths_1.DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
    storageService.deleteFile(pathOnDisk);
}
function slugifySkuPart(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'x';
}
function buildVariantSkuFromAttributes(baseSku, attributes, skuCodeByAttribute) {
    const keys = Object.keys(attributes).sort((a, b) => a.localeCompare(b));
    const parts = keys.map(k => {
        const code = skuCodeByAttribute?.[k]?.trim();
        return slugifySkuPart(code || String(attributes[k] ?? ''));
    });
    const base = slugifySkuPart(baseSku || 'p');
    const joined = [base, ...parts].filter(Boolean).join('-');
    return joined.slice(0, 120).toUpperCase();
}
async function loadVariantValueSkuCodes(valueIds) {
    const map = new Map();
    const ids = [...new Set(valueIds.filter((id) => Number.isFinite(id)))];
    if (!ids.length)
        return map;
    try {
        const [rows] = await database_1.db.query(`SELECT vtv.id, vt.name AS attribute_name, vtv.sku_code
       FROM variant_type_values vtv
       JOIN variant_types vt ON vt.id = vtv.variant_type_id
       WHERE vtv.id IN (?)`, [ids]);
        for (const row of rows) {
            const code = row.sku_code != null ? String(row.sku_code).trim() : '';
            map.set(Number(row.id), {
                attributeName: String(row.attribute_name || ''),
                skuCode: code || null
            });
        }
    }
    catch (error) {
        if (error?.errno !== 1054)
            throw error;
    }
    return map;
}
function allocateUniqueSku(candidate, used) {
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
class ProductsController {
    static async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const search = req.query.search;
            const category_id = req.query.category_id ? parseInt(req.query.category_id) : undefined;
            const statusQuery = typeof req.query.status === 'string' ? req.query.status : '';
            let status;
            let is_featured;
            let is_on_sale;
            if (statusQuery === 'featured') {
                is_featured = true;
            }
            else if (statusQuery === 'on_sale') {
                is_on_sale = true;
            }
            else if (statusQuery) {
                status = statusQuery;
            }
            const filters = {};
            if (search)
                filters.search = search;
            if (category_id !== undefined)
                filters.category_id = category_id;
            if (status)
                filters.status = status;
            if (is_featured !== undefined)
                filters.is_featured = is_featured;
            if (is_on_sale !== undefined)
                filters.is_on_sale = is_on_sale;
            const result = await productService.getAllProducts(page, limit, filters);
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = res.locals.t || ((key) => key);
            res.render('products/products', {
                title: 'Products',
                pageTitle: t('ecommerce.products.title'),
                siteTitle,
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
        }
        catch (error) {
            console.error('Error rendering products page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async create(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const categories = await categoryService.getAllCategories(true);
            const brands = await brandService.getAllBrands(true);
            const variantTypes = await productAttributeService.getAllProductAttributes();
            const t = res.locals.t || ((key) => key);
            res.render('products/create-product', {
                title: t('ecommerce.products.createProduct'),
                pageTitle: t('ecommerce.products.createProduct'),
                siteTitle,
                categories,
                brands,
                variantTypes,
                includeCustomEditor: true
            });
        }
        catch (error) {
            console.error('Error rendering create product page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async createPost(req, res) {
        try {
            const productData = {
                name: req.body.name,
                slug: req.body.slug || req.body.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-'),
                price: parseFloat(req.body.price),
                stock_quantity: parseInt(req.body.stock_quantity) || 0,
                low_stock_threshold: req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : 5,
                is_featured: req.body.is_featured === 'true' || req.body.is_featured === 'on',
                is_on_sale: req.body.is_on_sale === 'true' || req.body.is_on_sale === 'on',
                is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off',
                include_in_auto_ads: req.body.include_in_auto_ads !== 'false' && req.body.include_in_auto_ads !== 'off',
                status: req.body.status || 'draft'
            };
            if (req.body.sku)
                productData.sku = req.body.sku;
            productData.brand_id = req.body.brand_id ? parseInt(req.body.brand_id, 10) : null;
            if (req.body.short_description)
                productData.short_description = req.body.short_description;
            if (req.body.description)
                productData.description = req.body.description;
            if (req.body.compare_at_price)
                productData.compare_at_price = parseFloat(req.body.compare_at_price);
            if (req.body.weight)
                productData.weight = parseFloat(req.body.weight);
            if (req.body.length)
                productData.length = parseFloat(req.body.length);
            if (req.body.width)
                productData.width = parseFloat(req.body.width);
            if (req.body.height)
                productData.height = parseFloat(req.body.height);
            if (req.body.category_ids) {
                productData.category_ids = Array.isArray(req.body.category_ids)
                    ? req.body.category_ids.map((id) => parseInt(id))
                    : [parseInt(req.body.category_ids)];
            }
            else if (req.body.category_id) {
                productData.category_ids = [parseInt(req.body.category_id)];
            }
            if (req.body.meta_title)
                productData.meta_title = req.body.meta_title;
            if (req.body.meta_description)
                productData.meta_description = req.body.meta_description;
            if (req.body.meta_keywords)
                productData.meta_keywords = req.body.meta_keywords;
            const product = await productService.createProduct(productData);
            if (req.file) {
                const productDir = (0, data_paths_1.getProductImagesDirPath)(product.id);
                if (!fs.existsSync(productDir)) {
                    fs.mkdirSync(productDir, { recursive: true });
                }
                const destPath = path.join(productDir, path.basename(req.file.path));
                storageService.moveFile(req.file.path, destPath);
                const imageUrl = (0, data_paths_1.getPublicUrl)(destPath);
                const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl);
                await productService.addProductImage(product.id, null, imageUrl, undefined, true, 0, thumbUrl);
            }
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
                }
                catch (error) {
                    console.error('Error creating variants:', error);
                }
            }
            res.redirect(`/admin/products/${product.id}/edit?success=Product created successfully`);
        }
        catch (error) {
            console.error('Error creating product:', error);
            res.redirect(`/admin/products/create?error=${encodeURIComponent(error.message || 'Failed to create product')}`);
        }
    }
    static async edit(req, res) {
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
            const t = res.locals.t || ((key) => key);
            const [variants] = await database_1.db.query('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
            const [images] = await database_1.db.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC', [productId]);
            res.render('products/edit-product', {
                title: `Edit Product - ${product.name}`,
                pageTitle: t('ecommerce.products.editProduct'),
                siteTitle,
                product,
                categories,
                brands,
                variantTypes,
                variants: variants.map(v => ({ ...v, attributes: JSON.parse(v.attributes) })),
                images: (0, productImageUrlService_1.normalizeProductImages)(productId, images),
                includeCustomEditor: true
            });
        }
        catch (error) {
            console.error('Error rendering edit product page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async editPost(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const productData = {};
            if (req.body.name)
                productData.name = req.body.name;
            if (req.body.slug)
                productData.slug = req.body.slug;
            if (req.body.sku !== undefined)
                productData.sku = req.body.sku || null;
            if (req.body.short_description !== undefined)
                productData.short_description = req.body.short_description || null;
            if (req.body.description !== undefined)
                productData.description = req.body.description || null;
            if (req.body.price)
                productData.price = parseFloat(req.body.price);
            if (req.body.compare_at_price !== undefined)
                productData.compare_at_price = req.body.compare_at_price ? parseFloat(req.body.compare_at_price) : null;
            if (req.body.stock_quantity !== undefined)
                productData.stock_quantity = parseInt(req.body.stock_quantity) || 0;
            if (req.body.low_stock_threshold !== undefined)
                productData.low_stock_threshold = req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : 5;
            if (req.body.weight !== undefined)
                productData.weight = req.body.weight ? parseFloat(req.body.weight) : null;
            if (req.body.length !== undefined)
                productData.length = req.body.length ? parseFloat(req.body.length) : null;
            if (req.body.width !== undefined)
                productData.width = req.body.width ? parseFloat(req.body.width) : null;
            if (req.body.height !== undefined)
                productData.height = req.body.height ? parseFloat(req.body.height) : null;
            productData.is_featured = req.body.is_featured === 'true' || req.body.is_featured === 'on';
            productData.is_on_sale = req.body.is_on_sale === 'true' || req.body.is_on_sale === 'on';
            productData.is_active = req.body.is_active === 'true' || req.body.is_active === 'on';
            productData.include_in_auto_ads =
                req.body.include_in_auto_ads === 'true' || req.body.include_in_auto_ads === 'on';
            if (req.body.status)
                productData.status = req.body.status;
            if (req.body.category_ids !== undefined) {
                productData.category_ids = Array.isArray(req.body.category_ids)
                    ? req.body.category_ids.map((id) => parseInt(id))
                    : [parseInt(req.body.category_ids)];
            }
            else if (req.body.category_id !== undefined) {
                productData.category_ids = req.body.category_id ? [parseInt(req.body.category_id)] : [];
            }
            productData.brand_id = req.body.brand_id ? parseInt(req.body.brand_id, 10) : null;
            if (req.body.meta_title !== undefined)
                productData.meta_title = req.body.meta_title || null;
            if (req.body.meta_description !== undefined)
                productData.meta_description = req.body.meta_description || null;
            if (req.body.meta_keywords !== undefined)
                productData.meta_keywords = req.body.meta_keywords || null;
            await productService.updateProduct(productId, productData);
            res.redirect(`/admin/products/${productId}/edit?success=Product updated successfully`);
        }
        catch (error) {
            console.error('Error updating product:', error);
            res.redirect(`/admin/products/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update product')}`);
        }
    }
    static async delete(req, res) {
        try {
            const productId = parseInt(req.params.id);
            await productService.deleteProduct(productId);
            res.json({ success: true });
        }
        catch (error) {
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
    static async uploadImage(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === 'on';
            const altText = req.body.alt_text || null;
            let files = [];
            if (req.files) {
                files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            }
            else if (req.file) {
                files = [req.file];
            }
            if (!files || files.length === 0) {
                res.status(400).json({ success: false, error: 'No files uploaded' });
                return;
            }
            const [orderRows] = await database_1.db.query('SELECT MAX(order_index) as max_order FROM product_images WHERE product_id = ?', [productId]);
            let orderIndex = (orderRows[0]?.max_order || -1) + 1;
            const uploadedImages = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file)
                    continue;
                const imageUrl = (0, data_paths_1.getPublicUrl)(file.path);
                const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl);
                const setAsPrimary = isPrimary && i === 0;
                const imageId = await productService.addProductImage(productId, null, imageUrl, altText || undefined, setAsPrimary, orderIndex, thumbUrl);
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
        }
        catch (error) {
            console.error('Error uploading product images:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to upload images' });
        }
    }
    static async deleteImage(req, res) {
        try {
            const imageId = parseInt(req.params.imageId);
            const productId = parseInt(req.params.id);
            const [imageRows] = await database_1.db.query('SELECT image_url, is_primary, product_id FROM product_images WHERE id = ?', [imageId]);
            if (imageRows.length === 0) {
                res.status(404).json({ success: false, error: 'Image not found' });
                return;
            }
            const wasPrimary = imageRows[0].is_primary;
            await productService.deleteProductImage(imageId);
            const imageUrl = imageRows[0].image_url;
            if (imageUrl) {
                (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(imageUrl);
                const imagePath = imageUrl.startsWith('/')
                    ? data_paths_1.DATA_PATHS.PUBLIC_DIR + imageUrl
                    : data_paths_1.DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
                storageService.deleteFile(imagePath);
            }
            if (wasPrimary) {
                const [remainingImages] = await database_1.db.query('SELECT id FROM product_images WHERE product_id = ? ORDER BY id ASC LIMIT 1', [productId]);
                if (remainingImages.length > 0) {
                    await productService.setPrimaryImage(productId, remainingImages[0].id);
                }
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting product image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete image' });
        }
    }
    static async copy(req, res) {
        try {
            const productId = parseInt(req.params.id, 10);
            if (Number.isNaN(productId) || productId < 1) {
                res.status(400).json({ success: false, error: 'Invalid product' });
                return;
            }
            const newId = await productManagementService.duplicateProduct(productId);
            res.json({ success: true, id: newId, redirect: `/admin/products/${newId}/edit` });
        }
        catch (error) {
            console.error('Error copying product:', error);
            const status = error.message === 'Product not found' ? 404 : 500;
            res.status(status).json({ success: false, error: error.message || 'Failed to copy product' });
        }
    }
    static async setPrimaryImage(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const imageId = parseInt(req.body.image_id);
            await productService.setPrimaryImage(productId, imageId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error setting primary image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to set primary image' });
        }
    }
    static async reorderImage(req, res) {
        try {
            const productId = parseInt(req.params.id, 10);
            const rawIds = Array.isArray(req.body.image_ids) ? req.body.image_ids : [];
            const imageIds = rawIds
                .map((id) => parseInt(String(id), 10))
                .filter((id) => !Number.isNaN(id));
            if (Number.isNaN(productId) || imageIds.length === 0) {
                res.status(400).json({ success: false, error: 'Invalid image reorder request' });
                return;
            }
            await productService.reorderProductImages(productId, imageIds);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error reordering product image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to reorder image' });
        }
    }
    static async getImages(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const images = (0, productImageUrlService_1.normalizeProductImages)(productId, await productService.getProductImages(productId));
            res.json({ success: true, images });
        }
        catch (error) {
            console.error('Error getting product images:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to get images' });
        }
    }
    static async createVariant(req, res) {
        try {
            const productId = parseInt(req.params.id);
            let { name, sku, price, stock_quantity, weight, attributes } = req.body;
            if (typeof attributes === 'string') {
                try {
                    attributes = JSON.parse(attributes);
                }
                catch (e) {
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
                const imageUrl = (0, data_paths_1.getPublicUrl)(req.file.path);
                const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl);
                await productService.addProductImage(productId, variantId, imageUrl, undefined, false, 0, thumbUrl);
            }
            res.json({ success: true, variant_id: variantId });
        }
        catch (error) {
            console.error('Error creating variant:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to create variant' });
        }
    }
    static async updateVariant(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const variantId = parseInt(req.params.variantId);
            const body = req.body;
            let { name, sku, price, stock_quantity, weight, attributes } = body;
            if (typeof attributes === 'string') {
                try {
                    attributes = JSON.parse(attributes);
                }
                catch (e) {
                    attributes = {};
                }
            }
            const updateData = {};
            if ('name' in body)
                updateData.name = name;
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
                const imageUrl = (0, data_paths_1.getPublicUrl)(req.file.path);
                await productService.addProductImage(productId, variantId, imageUrl, undefined, false, 0);
                await productManagementService.updateProductVariant(variantId, {
                    has_image: true
                });
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating variant:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update variant' });
        }
    }
    static async deleteVariant(req, res) {
        try {
            const variantId = parseInt(req.params.variantId);
            await productManagementService.deleteProductVariant(variantId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting variant:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete variant' });
        }
    }
    static async uploadVariantImage(req, res) {
        try {
            const productId = parseInt(req.params.id);
            let variantId = null;
            const variantIdParam = req.params.variantId;
            if (variantIdParam && !variantIdParam.startsWith('new-')) {
                variantId = parseInt(variantIdParam);
            }
            if (!req.file) {
                res.status(400).json({ success: false, error: 'No file uploaded' });
                return;
            }
            const imageUrl = (0, data_paths_1.getPublicUrl)(req.file.path);
            const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl);
            if (!variantId || isNaN(variantId)) {
                res.status(400).json({ success: false, error: 'Variant must be saved before uploading image. Please save the variant first, then upload the image.' });
                return;
            }
            const imageId = await productService.addProductImage(productId, null, imageUrl, undefined, false, 0, thumbUrl);
            res.json({ success: true, image_id: imageId, image_url: imageUrl });
        }
        catch (error) {
            console.error('Error uploading variant image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to upload variant image' });
        }
    }
    static async deleteVariantImage(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const variantId = parseInt(req.params.variantId);
            const imageId = parseInt(req.params.imageId);
            const [imageRows] = await database_1.db.query('SELECT image_url FROM product_images WHERE id = ? AND variant_id = ? AND product_id = ?', [imageId, variantId, productId]);
            if (imageRows.length === 0) {
                res.status(404).json({ success: false, error: 'Image not found' });
                return;
            }
            await productService.deleteProductImage(imageId);
            const imageUrl = imageRows[0].image_url;
            if (imageUrl) {
                (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(imageUrl);
                const imagePath = imageUrl.startsWith('/')
                    ? data_paths_1.DATA_PATHS.PUBLIC_DIR + imageUrl
                    : data_paths_1.DATA_PATHS.PUBLIC_DIR + '/' + imageUrl;
                storageService.deleteFile(imagePath);
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting variant image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete variant image' });
        }
    }
    static async getProductAttributes(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const attributes = await productAttributeService.getProductAttributes(productId);
            res.json({ success: true, attributes });
        }
        catch (error) {
            console.error('Error getting product attributes:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to get product attributes' });
        }
    }
    static async addProductAttribute(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const { variant_type_id } = req.body;
            if (!variant_type_id) {
                res.status(400).json({ success: false, error: 'variant_type_id is required' });
                return;
            }
            await productAttributeService.addProductAttribute(productId, parseInt(variant_type_id));
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error adding product attribute:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to add product attribute' });
        }
    }
    static async removeProductAttribute(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const attributeId = parseInt(req.params.attributeId);
            await productAttributeService.removeProductAttribute(productId, attributeId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error removing product attribute:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to remove product attribute' });
        }
    }
    static async updateAttributeSelection(req, res) {
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
        }
        catch (error) {
            console.error('Error updating attribute selection:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update attribute selection' });
        }
    }
    static async uploadAttributeValueImage(req, res) {
        try {
            const valueId = parseInt(req.params.valueId, 10);
            const productIdRaw = req.query.productId;
            const productId = productIdRaw !== undefined && productIdRaw !== '' ? parseInt(String(productIdRaw), 10) : NaN;
            if (!req.file) {
                res.status(400).json({ success: false, error: 'No file uploaded' });
                return;
            }
            if (Number.isNaN(productId)) {
                res.status(400).json({ success: false, error: 'productId is required' });
                return;
            }
            const imageUrl = (0, data_paths_1.getPublicUrl)(req.file.path);
            const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl);
            const [piRows] = await database_1.db.query('SELECT id, image_url FROM product_images WHERE product_id = ? AND attribute_value_id = ?', [productId, valueId]);
            for (const row of piRows) {
                if (row.image_url) {
                    await safeDeleteImageFile(row.image_url, row.id);
                }
            }
            await productAttributeService.uploadProductAttributeValueImage(productId, valueId, imageUrl, thumbUrl);
            const prevGlobalUrl = await productAttributeService.clearAttributeValueGlobalImage(valueId);
            if (prevGlobalUrl && prevGlobalUrl !== imageUrl) {
                await safeDeleteImageFile(prevGlobalUrl);
            }
            res.json({ success: true, image_url: imageUrl, thumb_url: thumbUrl });
        }
        catch (error) {
            console.error('Error uploading attribute value image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to upload attribute value image' });
        }
    }
    static async deleteAttributeValueImage(req, res) {
        try {
            const valueId = parseInt(req.params.valueId, 10);
            const productIdRaw = req.query.productId;
            const productId = productIdRaw !== undefined && productIdRaw !== ''
                ? parseInt(String(productIdRaw), 10)
                : NaN;
            if (!Number.isNaN(productId)) {
                const [piRows] = await database_1.db.query('SELECT id, image_url FROM product_images WHERE product_id = ? AND attribute_value_id = ?', [productId, valueId]);
                for (const row of piRows) {
                    if (row.image_url) {
                        await safeDeleteImageFile(row.image_url, row.id);
                    }
                }
                await productAttributeService.deleteProductAttributeValueImage(productId, valueId);
            }
            else {
                res.status(400).json({ success: false, error: 'productId is required' });
                return;
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting attribute value image:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete attribute value image' });
        }
    }
    static async resetAllVariantStocks(req, res) {
        try {
            const productId = parseInt(req.params.id, 10);
            const raw = req.body.stock_quantity ?? req.body.stock;
            const n = parseInt(String(raw ?? ''), 10);
            if (Number.isNaN(productId) || productId < 1) {
                res.status(400).json({ success: false, error: 'Invalid product' });
                return;
            }
            if (Number.isNaN(n) || n < 0) {
                res.status(400).json({ success: false, error: 'Enter a valid stock quantity (0 or greater)' });
                return;
            }
            const [result] = await database_1.db.query('UPDATE product_variants SET stock_quantity = ?, updated_at = NOW() WHERE product_id = ?', [n, productId]);
            const affected = result.affectedRows ?? 0;
            res.json({ success: true, updated: affected, stock_quantity: n });
        }
        catch (error) {
            console.error('Error resetting variant stocks:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update stocks' });
        }
    }
    static async createBulkVariants(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const { variants } = req.body;
            if (!variants || !Array.isArray(variants)) {
                res.status(400).json({ success: false, error: 'variants array is required' });
                return;
            }
            const [productRows] = await database_1.db.query('SELECT id, sku FROM products WHERE id = ?', [productId]);
            const productSku = productRows.length > 0 && productRows[0].sku && String(productRows[0].sku).trim()
                ? String(productRows[0].sku).trim().toUpperCase()
                : `P${productId}`;
            const [existingSkuRows] = await database_1.db.query("SELECT sku FROM product_variants WHERE product_id = ? AND sku IS NOT NULL AND TRIM(sku) <> ''", [productId]);
            const usedSkus = new Set(existingSkuRows
                .map((r) => r.sku)
                .filter(Boolean)
                .map((s) => s.toUpperCase()));
            const valueIds = [];
            for (const variant of variants) {
                const entries = Array.isArray(variant?.valueIds) ? variant.valueIds : [];
                for (const entry of entries) {
                    const id = typeof entry === 'object' && entry ? parseInt(entry.id, 10) : parseInt(entry, 10);
                    if (!Number.isNaN(id))
                        valueIds.push(id);
                }
            }
            const skuCodes = await loadVariantValueSkuCodes(valueIds);
            const variantsData = variants.map((v) => {
                const attrs = (v.attributes && typeof v.attributes === 'object' ? v.attributes : {});
                const skuCodeByAttribute = {};
                const entries = Array.isArray(v.valueIds) ? v.valueIds : [];
                for (const entry of entries) {
                    const id = typeof entry === 'object' && entry ? parseInt(entry.id, 10) : parseInt(entry, 10);
                    const meta = skuCodes.get(id);
                    if (!meta?.skuCode)
                        continue;
                    const attributeName = typeof entry === 'object' && entry?.attribute
                        ? String(entry.attribute)
                        : meta.attributeName;
                    if (attributeName)
                        skuCodeByAttribute[attributeName] = meta.skuCode;
                }
                let sku = v.sku && String(v.sku).trim() ? String(v.sku).trim().toUpperCase() : null;
                if (!sku) {
                    const candidate = buildVariantSkuFromAttributes(productSku, attrs, skuCodeByAttribute);
                    sku = allocateUniqueSku(candidate, usedSkus);
                }
                else if (usedSkus.has(sku)) {
                    sku = allocateUniqueSku(sku, usedSkus);
                }
                else {
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
                    has_image: false
                };
            });
            await productManagementService.createProductVariantsBulk(variantsData);
            res.json({ success: true, count: variantsData.length });
        }
        catch (error) {
            console.error('Error creating bulk variants:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to create variants' });
        }
    }
}
exports.ProductsController = ProductsController;
//# sourceMappingURL=productsController.js.map