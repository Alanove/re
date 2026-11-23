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
exports.ProductManagementService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const database_1 = require("../../src/config/database");
const data_paths_1 = require("../../src/constants/data-paths");
const imageThumbService_1 = require("../../src/services/imageThumbService");
class ProductManagementService {
    constructor() { }
    static getInstance() {
        if (!ProductManagementService.instance) {
            ProductManagementService.instance = new ProductManagementService();
        }
        return ProductManagementService.instance;
    }
    async createProduct(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO products (
          name, slug, sku, short_description, description, price, compare_at_price,
          cost_price, weight, length, width, height, stock_quantity, low_stock_threshold,
          track_inventory, is_featured, is_on_sale, is_active, include_in_auto_ads, status, category_id, brand_id, size_chart_id,
          meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            ]);
            const productId = result.insertId;
            if (data.category_ids && data.category_ids.length > 0) {
                const values = data.category_ids.map(catId => [productId, catId]);
                await database_1.db.query('INSERT INTO product_category_relations (product_id, category_id) VALUES ?', [values]);
            }
            else if (data.category_id) {
                await database_1.db.query('INSERT INTO product_category_relations (product_id, category_id) VALUES (?, ?)', [productId, data.category_id]);
            }
            const product = await this.getProductById(productId);
            if (!product) {
                throw new Error('Failed to retrieve created product');
            }
            return product;
        }
        catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }
    async updateProduct(id, data) {
        try {
            const updates = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && key !== 'category_ids') {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            });
            if (data.category_ids !== undefined) {
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
            await database_1.db.query(`UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            if (data.category_ids !== undefined) {
                await database_1.db.query('DELETE FROM product_category_relations WHERE product_id = ?', [id]);
                if (data.category_ids.length > 0) {
                    const relationValues = data.category_ids.map(catId => [id, catId]);
                    await database_1.db.query('INSERT INTO product_category_relations (product_id, category_id) VALUES ?', [relationValues]);
                }
            }
            const product = await this.getProductById(id);
            if (!product) {
                throw new Error('Product not found');
            }
            return product;
        }
        catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }
    async deleteProduct(id) {
        try {
            const [orderRows] = await database_1.db.query('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?', [id]);
            if (orderRows[0].count > 0) {
                throw new Error('Cannot delete this product because it is referenced by existing orders. Consider deactivating it instead.');
            }
            await database_1.db.query('DELETE FROM products WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }
    async getProductById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM products WHERE id = ?', [id]);
            if (rows.length > 0) {
                const product = rows[0];
                const [catRows] = await database_1.db.query('SELECT category_id FROM product_category_relations WHERE product_id = ?', [id]);
                product.category_ids = catRows.map((r) => r.category_id);
                return product;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting product by ID:', error);
            throw error;
        }
    }
    async getAllProducts(page = 1, limit = 50, filters) {
        try {
            let whereConditions = [];
            let queryParams = [];
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
            const [countRows] = await database_1.db.query(`SELECT COUNT(*) as count FROM products p ${whereClause}`, queryParams);
            const total = countRows.length > 0 ? countRows[0].count : 0;
            const offset = (page - 1) * limit;
            const totalPages = Math.ceil(total / limit);
            const [rows] = await database_1.db.query(`SELECT p.*,
                (SELECT GROUP_CONCAT(pc.name SEPARATOR ', ') 
                 FROM product_category_relations pcr 
                 JOIN product_categories pc ON pcr.category_id = pc.id 
                 WHERE pcr.product_id = p.id) as category_name
         FROM products p
         ${whereClause} 
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
            const productsWithImages = await Promise.all(rows.map(async (product) => {
                const [imageRows] = await database_1.db.query('SELECT image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC LIMIT 5', [product.id]);
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
        }
        catch (error) {
            console.error('Error getting all products:', error);
            throw error;
        }
    }
    async addProductVariant(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO product_variants(
        product_id, sku, name, attributes, price, compare_at_price,
        stock_quantity, low_stock_threshold, track_inventory, weight, is_default, has_image
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            ]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error adding product variant:', error);
            throw error;
        }
    }
    async updateProductVariant(id, data) {
        try {
            const updates = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && key !== 'product_id') {
                    if (key === 'attributes') {
                        updates.push('attributes = ?');
                        values.push(JSON.stringify(value));
                    }
                    else {
                        updates.push(`${key} = ?`);
                        values.push(value);
                    }
                }
            });
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE product_variants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? `, values);
            }
        }
        catch (error) {
            console.error('Error updating product variant:', error);
            throw error;
        }
    }
    async deleteProductVariant(id) {
        try {
            await database_1.db.query('DELETE FROM product_variants WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting product variant:', error);
            throw error;
        }
    }
    async addProductImage(productId, variantId, imageUrl, altText, isPrimary = false, orderIndex = 0, thumbUrl) {
        try {
            if (isPrimary) {
                await database_1.db.query('UPDATE product_images SET is_primary = FALSE WHERE product_id = ?', [productId]);
            }
            const [result] = await database_1.db.query(`INSERT INTO product_images(
        product_id, variant_id, image_url, thumb_url, alt_text, is_primary, order_index
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`, [productId, variantId, imageUrl, thumbUrl ?? null, altText || null, isPrimary, orderIndex]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error adding product image:', error);
            throw error;
        }
    }
    async deleteProductImage(imageId) {
        try {
            await database_1.db.query('DELETE FROM product_images WHERE id = ?', [imageId]);
        }
        catch (error) {
            console.error('Error deleting product image:', error);
            throw error;
        }
    }
    async getProductImages(productId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC', [productId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting product images:', error);
            throw error;
        }
    }
    async reorderProductImages(productId, imageIds) {
        const [rows] = await database_1.db.query('SELECT id FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC', [productId]);
        const allowed = rows.map((row) => Number(row.id));
        const allowedSet = new Set(allowed);
        const ordered = imageIds.filter((id) => allowedSet.has(id));
        for (const id of allowed) {
            if (!ordered.includes(id))
                ordered.push(id);
        }
        for (let i = 0; i < ordered.length; i++) {
            await database_1.db.query('UPDATE product_images SET order_index = ? WHERE id = ? AND product_id = ?', [
                i,
                ordered[i],
                productId
            ]);
        }
    }
    async updateProductImageOrder(imageId, orderIndex) {
        try {
            await database_1.db.query('UPDATE product_images SET order_index = ? WHERE id = ?', [orderIndex, imageId]);
        }
        catch (error) {
            console.error('Error updating product image order:', error);
            throw error;
        }
    }
    async setPrimaryImage(productId, imageId) {
        try {
            await database_1.db.query('UPDATE product_images SET is_primary = FALSE WHERE product_id = ?', [productId]);
            await database_1.db.query('UPDATE product_images SET is_primary = TRUE WHERE id = ?', [imageId]);
        }
        catch (error) {
            console.error('Error setting primary image:', error);
            throw error;
        }
    }
    async getLowStockProducts() {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM products 
        WHERE track_inventory = TRUE 
        AND stock_quantity <= low_stock_threshold 
        AND is_active = TRUE
        ORDER BY stock_quantity ASC`);
            return rows;
        }
        catch (error) {
            console.error('Error getting low stock products:', error);
            throw error;
        }
    }
    async bulkUpdateStock(updates) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            for (const update of updates) {
                if (update.variant_id) {
                    await connection.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [update.quantity, update.variant_id]);
                }
                else {
                    await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [update.quantity, update.product_id]);
                }
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error bulk updating stock:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async createProductVariantsBulk(variantsData) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            for (const data of variantsData) {
                await connection.query(`INSERT INTO product_variants(
        product_id, sku, name, attributes, price, compare_at_price,
        stock_quantity, low_stock_threshold, track_inventory, weight, is_default, has_image
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error bulk creating product variants:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async duplicateProduct(sourceId) {
        const connection = await database_1.db.getConnection();
        let newProductId = 0;
        let copiedFiles = false;
        try {
            await connection.beginTransaction();
            const [srcRows] = await connection.query('SELECT * FROM products WHERE id = ?', [sourceId]);
            if (!srcRows.length) {
                throw new Error('Product not found');
            }
            const src = srcRows[0];
            const usedSkus = new Set();
            const name = await this.uniqueCopyName(connection, String(src.name || 'Product'));
            const slug = await this.uniqueSlug(connection, this.slugifyName(name));
            const sku = src.sku ? await this.allocateCopySku(connection, String(src.sku), usedSkus) : null;
            const [insertResult] = await connection.query(`INSERT INTO products (
          name, slug, sku, short_description, description, price, compare_at_price,
          cost_price, weight, length, width, height, stock_quantity, low_stock_threshold,
          track_inventory, is_featured, is_on_sale, is_active, include_in_auto_ads, status, category_id, brand_id, size_chart_id,
          meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            ]);
            newProductId = insertResult.insertId;
            await connection.query(`INSERT INTO product_category_relations (product_id, category_id)
         SELECT ?, category_id FROM product_category_relations WHERE product_id = ?`, [newProductId, sourceId]);
            const [attributeRows] = await connection.query('SELECT variant_type_id, selected_values FROM product_attributes WHERE product_id = ?', [sourceId]);
            for (const row of attributeRows) {
                const selected = row.selected_values == null
                    ? null
                    : typeof row.selected_values === 'string'
                        ? row.selected_values
                        : JSON.stringify(row.selected_values);
                await connection.query('INSERT INTO product_attributes (product_id, variant_type_id, selected_values) VALUES (?, ?, ?)', [newProductId, row.variant_type_id, selected]);
            }
            const [variants] = await connection.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [sourceId]);
            const variantIdMap = new Map();
            for (const variant of variants) {
                const variantSku = variant.sku
                    ? await this.allocateCopySku(connection, String(variant.sku), usedSkus)
                    : null;
                const attributes = variant.attributes == null
                    ? '{}'
                    : typeof variant.attributes === 'string'
                        ? variant.attributes
                        : JSON.stringify(variant.attributes);
                const [variantInsert] = await connection.query(`INSERT INTO product_variants (
            product_id, sku, name, attributes, price, compare_at_price,
            stock_quantity, low_stock_threshold, track_inventory, weight, is_default, is_active, has_image
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ]);
                variantIdMap.set(Number(variant.id), variantInsert.insertId);
            }
            const [images] = await connection.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index ASC, id ASC', [sourceId]);
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                const newUrl = await this.copyImageToProductFolder(String(image.image_url || ''), newProductId, i);
                if (!newUrl)
                    continue;
                copiedFiles = true;
                const thumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(newUrl);
                const newVariantId = image.variant_id != null
                    ? (variantIdMap.get(Number(image.variant_id)) ?? null)
                    : null;
                await connection.query(`INSERT INTO product_images (
            product_id, variant_id, image_url, thumb_url, alt_text, is_primary, order_index, attribute_value_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    newProductId,
                    newVariantId,
                    newUrl,
                    thumbUrl,
                    image.alt_text ?? null,
                    image.is_primary ?? false,
                    image.order_index ?? i,
                    image.attribute_value_id ?? null
                ]);
            }
            await connection.commit();
            return newProductId;
        }
        catch (error) {
            await connection.rollback();
            if (copiedFiles && newProductId) {
                fs.rmSync((0, data_paths_1.getProductImagesDirPath)(newProductId), { recursive: true, force: true });
            }
            console.error('Error duplicating product:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    slugifyName(name) {
        const slug = name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || 'product';
    }
    async uniqueCopyName(connection, original) {
        let name = `${original} - Copy`;
        let n = 2;
        while (true) {
            const [rows] = await connection.query('SELECT id FROM products WHERE name = ? LIMIT 1', [name]);
            if (!rows.length)
                return name;
            name = `${original} - Copy ${n}`;
            n++;
        }
    }
    async uniqueSlug(connection, base) {
        let slug = base.slice(0, 480);
        let n = 2;
        while (true) {
            const [rows] = await connection.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
            if (!rows.length)
                return slug;
            slug = `${base.slice(0, 470)}-${n}`;
            n++;
        }
    }
    async allocateCopySku(connection, base, used) {
        const root = base.trim().toUpperCase().slice(0, 240) || 'PRODUCT';
        let n = 1;
        while (n < 100000) {
            const suffix = n === 1 ? '-COPY' : `-COPY-${n}`;
            const candidate = `${root.slice(0, 255 - suffix.length)}${suffix}`;
            if (!used.has(candidate)) {
                const [productRows] = await connection.query('SELECT id FROM products WHERE sku = ? LIMIT 1', [candidate]);
                const [variantRows] = await connection.query('SELECT id FROM product_variants WHERE sku = ? LIMIT 1', [candidate]);
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
    async copyImageToProductFolder(sourceUrl, productId, index) {
        const trimmed = sourceUrl.trim();
        if (!trimmed)
            return null;
        const destDir = (0, data_paths_1.getProductImagesDirPath)(productId);
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
        }
        else {
            const abs = (0, imageThumbService_1.publicUrlToAbsolutePath)(trimmed);
            if (!abs || !fs.existsSync(abs)) {
                console.warn('Product image file missing, skipped', trimmed);
                return null;
            }
            fs.copyFileSync(abs, destAbs);
        }
        return (0, data_paths_1.getProductImagePublicUrl)(productId, filename);
    }
}
exports.ProductManagementService = ProductManagementService;
exports.default = ProductManagementService.getInstance();
//# sourceMappingURL=productManagementService.js.map