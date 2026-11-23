"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
exports.attachMultiPriceListingFieldsForProduct = attachMultiPriceListingFieldsForProduct;
const database_1 = require("../config/database");
const productAttributeService_1 = require("../../admin/services/productAttributeService");
const variantDisplayService_1 = require("./variantDisplayService");
const imageThumbService_1 = require("./imageThumbService");
const productImageUrlService_1 = require("./productImageUrlService");
function attachMultiPriceListingFieldsForProduct(product, variants) {
    if (!variants || variants.length === 0) {
        product.has_multi_prices = false;
        return;
    }
    const prices = [];
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
    const round2 = (x) => Math.round(x * 100) / 100;
    const uniques = new Set(prices.map(round2));
    product.has_multi_prices = uniques.size > 1;
}
class ProductService {
    constructor() { }
    static getInstance() {
        if (!ProductService.instance) {
            ProductService.instance = new ProductService();
        }
        return ProductService.instance;
    }
    async getProductById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM products WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting product by ID:', error);
            throw error;
        }
    }
    async getProductBySlug(slug) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM products WHERE slug = ?', [slug]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting product by slug:', error);
            throw error;
        }
    }
    async getProductWithDetails(id) {
        try {
            const product = await this.getProductById(id);
            if (!product)
                return null;
            let category = null;
            if (product.category_id) {
                const [categoryRows] = await database_1.db.query('SELECT id, name, slug FROM product_categories WHERE id = ?', [product.category_id]);
                if (categoryRows.length > 0) {
                    category = categoryRows[0];
                }
            }
            const [allCategoryRows] = await database_1.db.query(`SELECT pc.id, pc.name, pc.slug 
         FROM product_categories pc
         JOIN product_category_relations pcr ON pc.id = pcr.category_id
         WHERE pcr.product_id = ?`, [id]);
            const [imageRows] = await database_1.db.query('SELECT id, image_url, thumb_url, alt_text, is_primary, order_index, attribute_value_id FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC, id ASC', [id]);
            const [variantRows] = await database_1.db.query('SELECT id, sku, name, attributes, price, compare_at_price, stock_quantity, is_default, track_inventory FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY is_default DESC, id ASC', [id]);
            const variants = variantRows.map(v => ({
                ...v,
                attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes
            }));
            let brand = null;
            const brandId = product.brand_id;
            if (brandId) {
                const [brandRows] = await database_1.db.query('SELECT id, name, slug, logo_url FROM brands WHERE id = ? AND is_active = TRUE', [brandId]);
                if (brandRows.length > 0)
                    brand = brandRows[0];
            }
            return {
                ...product,
                category,
                brand,
                categories: allCategoryRows,
                images: (0, productImageUrlService_1.normalizeProductImages)(id, imageRows),
                variants
            };
        }
        catch (error) {
            console.error('Error getting product with details:', error);
            throw error;
        }
    }
    async getProducts(filters = {}) {
        try {
            const { category_id, category_slug, search, min_price, max_price, is_featured, is_active = true, status = 'published', in_stock, sort_by = 'created_at', sort_order = 'DESC', page = 1, limit = 20 } = filters;
            let whereConditions = [];
            let queryParams = [];
            if (category_id) {
                whereConditions.push('p.id IN (SELECT product_id FROM product_category_relations WHERE category_id = ?)');
                queryParams.push(category_id);
            }
            if (category_slug) {
                whereConditions.push('p.id IN (SELECT pcr.product_id FROM product_category_relations pcr JOIN product_categories pc ON pcr.category_id = pc.id WHERE pc.slug = ?)');
                queryParams.push(category_slug);
            }
            if (filters.brand_id) {
                whereConditions.push('p.brand_id = ?');
                queryParams.push(filters.brand_id);
            }
            if (filters.brand_slug) {
                whereConditions.push('p.brand_id IN (SELECT id FROM brands WHERE slug = ?)');
                queryParams.push(filters.brand_slug);
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
            if (filters.attributes && Object.keys(filters.attributes).length > 0) {
                const attributeFilters = filters.attributes;
                const attributeConditions = [];
                const attributeParams = [];
                for (const [attrSlug, valueArray] of Object.entries(attributeFilters)) {
                    if (Array.isArray(valueArray) && valueArray.length > 0) {
                        const [variantTypeRows] = await database_1.db.query('SELECT id FROM variant_types WHERE slug = ? AND is_active = TRUE', [attrSlug]);
                        if (variantTypeRows.length > 0) {
                            const variantTypeId = variantTypeRows[0].id;
                            const placeholders = valueArray.map(() => '?').join(',');
                            const [valueRows] = await database_1.db.query(`SELECT id FROM variant_type_values WHERE variant_type_id = ? AND value IN (${placeholders}) AND is_active = TRUE`, [variantTypeId, ...valueArray]);
                            if (valueRows.length > 0) {
                                const valueIds = valueRows.map((row) => row.id);
                                const valueChecks = valueIds.map((id, index) => {
                                    return `JSON_CONTAINS(selected_values, ?)`;
                                }).join(' OR ');
                                attributeConditions.push(`p.id IN (
                    SELECT product_id FROM product_attributes 
                    WHERE variant_type_id = ? 
                    AND (${valueChecks})
                  )`);
                                attributeParams.push(variantTypeId, ...valueIds.map(id => JSON.stringify([id])));
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
            const [countRows] = await database_1.db.query(`SELECT COUNT(*) as count FROM products p ${whereClause}`, queryParams);
            const total = countRows[0]?.count || 0;
            const validSortFields = ['name', 'price', 'created_at', 'rating_average', 'view_count'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
            const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';
            const offset = (page - 1) * limit;
            const totalPages = Math.ceil(total / limit);
            const [rows] = await database_1.db.query(`SELECT p.*, (SELECT COUNT(*) > 0 FROM product_variants WHERE product_id = p.id AND is_active = TRUE) as has_variants FROM products p ${whereClause} ORDER BY p.${sortField} ${sortDirection} LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
            if (rows.length > 0) {
                const productIds = rows.map(p => p.id);
                const [imageRows] = await database_1.db.query(`SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`, [productIds]);
                rows.forEach((product) => {
                    product.has_variants = product.has_variants === 1 || product.has_variants === true;
                    product.images = imageRows.filter((img) => img.product_id === product.id).map((img) => {
                        const normalized = (0, productImageUrlService_1.normalizeProductImageRow)(product.id, img);
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
                            thumb_url: (0, imageThumbService_1.resolveListingThumbUrl)(imageUrl, rawThumb),
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
        }
        catch (error) {
            console.error('Error getting products:', error);
            throw error;
        }
    }
    async attachColorOptionsForListing(products) {
        if (!products || products.length === 0)
            return;
        const productIds = products.map((p) => p.id);
        const [variantRows] = await database_1.db.query(`SELECT id, product_id, sku, name, attributes, price, stock_quantity, is_default, track_inventory
       FROM product_variants WHERE product_id IN (?) AND is_active = TRUE ORDER BY product_id, is_default DESC, id ASC`, [productIds]);
        const byProduct = new Map();
        for (const row of variantRows) {
            const pid = row.product_id;
            if (!byProduct.has(pid))
                byProduct.set(pid, []);
            byProduct.get(pid).push({
                ...row,
                attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes
            });
        }
        for (const product of products) {
            const variants = byProduct.get(product.id) || [];
            product.has_variants = variants.length > 0;
            attachMultiPriceListingFieldsForProduct(product, variants);
            const pas = await productAttributeService_1.ProductAttributeService.getInstance().getProductAttributes(product.id);
            product.color_options = (0, variantDisplayService_1.buildColorOptionsForListing)(product, variants, pas);
        }
    }
    async getProductPriceRange(filters = {}) {
        try {
            const { category_id, category_slug, search, is_featured, is_active = true, status = 'published', in_stock } = filters;
            let whereConditions = [];
            let queryParams = [];
            if (category_id) {
                whereConditions.push('p.id IN (SELECT product_id FROM product_category_relations WHERE category_id = ?)');
                queryParams.push(category_id);
            }
            if (category_slug) {
                whereConditions.push('p.id IN (SELECT pcr.product_id FROM product_category_relations pcr JOIN product_categories pc ON pcr.category_id = pc.id WHERE pc.slug = ?)');
                queryParams.push(category_slug);
            }
            if (filters.brand_id) {
                whereConditions.push('p.brand_id = ?');
                queryParams.push(filters.brand_id);
            }
            if (filters.brand_slug) {
                whereConditions.push('p.brand_id IN (SELECT id FROM brands WHERE slug = ?)');
                queryParams.push(filters.brand_slug);
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
            if (filters.attributes && Object.keys(filters.attributes).length > 0) {
                const attributeFilters = filters.attributes;
                const attributeConditions = [];
                const attributeParams = [];
                for (const [attrSlug, valueArray] of Object.entries(attributeFilters)) {
                    if (Array.isArray(valueArray) && valueArray.length > 0) {
                        const [variantTypeRows] = await database_1.db.query('SELECT id FROM variant_types WHERE slug = ? AND is_active = TRUE', [attrSlug]);
                        if (variantTypeRows.length > 0) {
                            const variantTypeId = variantTypeRows[0].id;
                            const placeholders = valueArray.map(() => '?').join(',');
                            const [valueRows] = await database_1.db.query(`SELECT id FROM variant_type_values WHERE variant_type_id = ? AND value IN (${placeholders}) AND is_active = TRUE`, [variantTypeId, ...valueArray]);
                            if (valueRows.length > 0) {
                                const valueIds = valueRows.map((row) => row.id);
                                const valueChecks = valueIds.map((id) => {
                                    return `JSON_CONTAINS(selected_values, ?)`;
                                }).join(' OR ');
                                attributeConditions.push(`p.id IN (
                      SELECT product_id FROM product_attributes 
                      WHERE variant_type_id = ? 
                      AND (${valueChecks})
                    )`);
                                attributeParams.push(variantTypeId, ...valueIds.map((id) => JSON.stringify([id])));
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
            const [rows] = await database_1.db.query(`SELECT MIN(price) as min_price, MAX(price) as max_price FROM products p ${whereClause}`, queryParams);
            return {
                min: rows[0]?.min_price || 0,
                max: rows[0]?.max_price || 0
            };
        }
        catch (error) {
            console.error('Error getting product price range:', error);
            return { min: 0, max: 0 };
        }
    }
    async getFeaturedProducts(limit = 10) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM products WHERE is_featured = TRUE AND is_active = TRUE AND status = 'published' ORDER BY created_at DESC LIMIT ?`, [limit]);
            if (rows.length > 0) {
                const productIds = rows.map(p => p.id);
                const [imageRows] = await database_1.db.query(`SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`, [productIds]);
                rows.forEach((product) => {
                    product.images = imageRows.filter((img) => img.product_id === product.id).map((img) => {
                        const normalized = (0, productImageUrlService_1.normalizeProductImageRow)(product.id, img);
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
                            thumb_url: (0, imageThumbService_1.resolveListingThumbUrl)(imageUrl, rawThumb),
                            thumb_url_db: rawThumb
                        };
                    });
                });
            }
            return rows;
        }
        catch (error) {
            console.error('Error getting featured products:', error);
            throw error;
        }
    }
    async getRelatedProducts(productId, categoryId, limit = 4) {
        try {
            const safeLimit = Math.min(20, Math.max(1, Number(limit) || 4));
            let rows = [];
            const [countRows] = await database_1.db.query('SELECT COUNT(*) as total FROM products WHERE id != ?', [productId]);
            const totalOtherProducts = Number(Array.isArray(countRows) && countRows[0] ? countRows[0].total : 0);
            const [activeCountRows] = await database_1.db.query("SELECT COUNT(*) as total FROM products WHERE id != ? AND is_active = 1 AND status = 'published'", [productId]);
            const activeOtherProducts = Number(Array.isArray(activeCountRows) && activeCountRows[0] ? activeCountRows[0].total : 0);
            console.log('[getRelatedProducts] productId=%s categoryId=%s totalOther=%s activePublished=%s', productId, categoryId, totalOtherProducts, activeOtherProducts);
            const [categoryIdRows] = await database_1.db.query('SELECT category_id FROM product_category_relations WHERE product_id = ?', [productId]);
            const categoryIds = categoryIdRows.map(r => r.category_id);
            if (categoryId != null)
                categoryIds.push(categoryId);
            const uniqueCategoryIds = [...new Set(categoryIds)].filter((id) => id != null && id > 0);
            if (uniqueCategoryIds.length > 0) {
                const [relatedByCategory] = await database_1.db.query(`SELECT DISTINCT p.* FROM products p
           LEFT JOIN product_category_relations pcr ON pcr.product_id = p.id AND pcr.category_id IN (?)
           WHERE p.id != ? AND p.is_active = TRUE AND p.status = 'published'
           AND (p.category_id IN (?) OR pcr.category_id IS NOT NULL)
           ORDER BY RAND()
           LIMIT ${safeLimit}`, [uniqueCategoryIds, productId, uniqueCategoryIds]);
                rows = Array.isArray(relatedByCategory) ? relatedByCategory : [];
                console.log('[getRelatedProducts] by category rows=%s', rows.length);
            }
            if (rows.length === 0) {
                const [anyProducts] = await database_1.db.query(`SELECT * FROM products WHERE id != ? AND is_active = 1 AND status = 'published' ORDER BY RAND() LIMIT ${safeLimit}`, [productId]);
                rows = Array.isArray(anyProducts) ? anyProducts : [];
                console.log('[getRelatedProducts] fallback any products rows=%s', rows.length);
            }
            if (rows.length > 0) {
                const productIds = rows.map(p => p.id);
                const [imageRows] = await database_1.db.query(`SELECT * FROM product_images WHERE product_id IN (?) ORDER BY product_id, is_primary DESC, order_index ASC`, [productIds]);
                rows.forEach((product) => {
                    product.images = imageRows.filter((img) => img.product_id === product.id).map((img) => {
                        const normalized = (0, productImageUrlService_1.normalizeProductImageRow)(product.id, img);
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
                            thumb_url: (0, imageThumbService_1.resolveListingThumbUrl)(imageUrl, rawThumb),
                            thumb_url_db: rawThumb
                        };
                    });
                });
            }
            return rows;
        }
        catch (error) {
            console.error('Error getting related products:', error);
            throw error;
        }
    }
    async incrementViewCount(productId) {
        try {
            await database_1.db.query('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [productId]);
        }
        catch (error) {
            console.error('Error incrementing view count:', error);
        }
    }
    async isInStock(productId, variantId, quantity = 1) {
        try {
            if (variantId) {
                const [rows] = await database_1.db.query('SELECT stock_quantity, track_inventory FROM product_variants WHERE id = ? AND is_active = TRUE', [variantId]);
                if (rows.length === 0)
                    return false;
                const variant = rows[0];
                return !variant.track_inventory || variant.stock_quantity >= quantity;
            }
            else {
                const [rows] = await database_1.db.query('SELECT stock_quantity, track_inventory FROM products WHERE id = ?', [productId]);
                if (rows.length === 0)
                    return false;
                const product = rows[0];
                return !product.track_inventory || product.stock_quantity >= quantity;
            }
        }
        catch (error) {
            console.error('Error checking stock:', error);
            return false;
        }
    }
    async getProductPrice(productId, variantId) {
        try {
            const toNum = (v) => {
                if (v === null || v === undefined || v === '')
                    return NaN;
                const n = parseFloat(String(v));
                return Number.isFinite(n) ? n : NaN;
            };
            if (variantId) {
                const [rows] = await database_1.db.query(`SELECT v.price AS variant_price, p.price AS product_price
           FROM product_variants v
           INNER JOIN products p ON p.id = v.product_id
           WHERE v.id = ? AND v.product_id = ? AND v.is_active = TRUE`, [variantId, productId]);
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
            const [rows] = await database_1.db.query('SELECT price FROM products WHERE id = ?', [productId]);
            const p = rows.length > 0 ? toNum(rows[0].price) : NaN;
            return Number.isNaN(p) ? 0 : p;
        }
        catch (error) {
            console.error('Error getting product price:', error);
            return 0;
        }
    }
}
exports.ProductService = ProductService;
exports.default = ProductService.getInstance();
//# sourceMappingURL=productService.js.map