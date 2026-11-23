"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAttributeService = void 0;
const database_1 = require("../../src/config/database");
const productImageUrlService_1 = require("../../src/services/productImageUrlService");
function normalizeSkuCode(value) {
    if (value === undefined || value === null)
        return null;
    const code = String(value).trim().toUpperCase().replace(/\s+/g, '');
    if (!code)
        return null;
    return code.slice(0, 32);
}
class ProductAttributeService {
    constructor() { }
    static getInstance() {
        if (!ProductAttributeService.instance) {
            ProductAttributeService.instance = new ProductAttributeService();
        }
        return ProductAttributeService.instance;
    }
    async getAllProductAttributes(includeInactive = false) {
        try {
            const whereClause = includeInactive ? '' : 'WHERE vt.is_active = TRUE';
            const [rows] = await database_1.db.query(`SELECT 
          vt.*,
          GROUP_CONCAT(
            CONCAT(vtv.id, ':', vtv.value, ':', IFNULL(vtv.color_code, ''), ':', vtv.display_order, ':', vtv.is_active, ':', vtv.is_preselected)
            ORDER BY vtv.display_order, vtv.value
            SEPARATOR '|'
          ) as values_data
        FROM variant_types vt
        LEFT JOIN variant_type_values vtv ON vt.id = vtv.variant_type_id ${includeInactive ? '' : 'AND vtv.is_active = TRUE'}
        ${whereClause}
        GROUP BY vt.id
        ORDER BY vt.display_order, vt.name`, []);
            return rows.map((row) => {
                const productAttribute = {
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    has_image: row.has_image === 1 || row.has_image === true,
                    display_order: row.display_order,
                    is_active: row.is_active === 1 || row.is_active === true,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    values: []
                };
                if (row.values_data) {
                    productAttribute.values = row.values_data.split('|').map((valStr) => {
                        const [id, value, color_code, display_order, is_active, is_preselected] = valStr.split(':');
                        return {
                            id: parseInt(id),
                            variant_type_id: row.id,
                            value,
                            sku_code: null,
                            color_code: color_code || null,
                            display_order: parseInt(display_order),
                            is_active: is_active === '1' || is_active === 'true',
                            is_preselected: is_preselected === '1' || is_preselected === 'true',
                            created_at: new Date(),
                            updated_at: new Date()
                        };
                    });
                }
                return productAttribute;
            });
        }
        catch (error) {
            console.error('Error getting product attributes:', error);
            throw error;
        }
    }
    async getProductAttributeById(id) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM variant_types WHERE id = ?`, [id]);
            if (rows.length === 0)
                return null;
            const productAttribute = rows[0];
            productAttribute.has_image = productAttribute.has_image === 1 || productAttribute.has_image === true;
            productAttribute.is_active = productAttribute.is_active === 1 || productAttribute.is_active === true;
            let valueRows;
            try {
                const [rows] = await database_1.db.query(`SELECT id, variant_type_id, value, sku_code, color_code, display_order, is_active, is_preselected, image_url, created_at, updated_at
           FROM variant_type_values 
           WHERE variant_type_id = ? 
           ORDER BY display_order, value`, [id]);
                valueRows = rows;
            }
            catch (error) {
                if (error?.errno !== 1054)
                    throw error;
                const [rows] = await database_1.db.query(`SELECT id, variant_type_id, value, color_code, display_order, is_active, is_preselected, image_url, created_at, updated_at
           FROM variant_type_values 
           WHERE variant_type_id = ? 
           ORDER BY display_order, value`, [id]);
                valueRows = rows.map((row) => ({ ...row, sku_code: null }));
            }
            productAttribute.values = valueRows.map((v) => {
                const rawColor = v.color_code;
                const colorCode = (typeof rawColor === 'string' && rawColor.trim()) ? rawColor.trim() : null;
                return {
                    ...v,
                    is_active: v.is_active === 1 || v.is_active === true,
                    is_preselected: v.is_preselected === 1 || v.is_preselected === true,
                    color_code: colorCode
                };
            });
            return productAttribute;
        }
        catch (error) {
            console.error('Error getting product attribute:', error);
            throw error;
        }
    }
    async createProductAttribute(data) {
        try {
            const slug = data.slug || this.generateSlug(data.name);
            const [result] = await database_1.db.query(`INSERT INTO variant_types (name, slug, description, has_image, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`, [
                data.name,
                data.slug || this.generateSlug(data.name),
                data.description || null,
                data.has_image !== undefined ? data.has_image : false,
                data.display_order || 0,
                data.is_active !== undefined ? data.is_active : true
            ]);
            const productAttributeId = result.insertId;
            if (data.values && data.values.length > 0) {
                await this.addProductAttributeValues(productAttributeId, data.values);
            }
            return productAttributeId;
        }
        catch (error) {
            console.error('Error creating product attribute:', error);
            throw error;
        }
    }
    async updateProductAttribute(id, data) {
        try {
            const updates = [];
            const values = [];
            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.slug !== undefined) {
                updates.push('slug = ?');
                values.push(data.slug);
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                values.push(data.description);
            }
            if (data.has_image !== undefined) {
                updates.push('has_image = ?');
                values.push(data.has_image);
            }
            if (data.display_order !== undefined) {
                updates.push('display_order = ?');
                values.push(data.display_order);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE variant_types SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
            if (data.values !== undefined) {
                await database_1.db.query('DELETE FROM variant_type_values WHERE variant_type_id = ?', [id]);
                if (data.values.length > 0) {
                    await this.addProductAttributeValues(id, data.values);
                }
            }
        }
        catch (error) {
            console.error('Error updating product attribute:', error);
            throw error;
        }
    }
    async deleteProductAttribute(id) {
        try {
            await database_1.db.query('DELETE FROM variant_types WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting product attribute:', error);
            throw error;
        }
    }
    async addProductAttributeValues(productAttributeId, values) {
        try {
            for (let i = 0; i < values.length; i++) {
                const value = values[i].trim();
                if (value) {
                    await database_1.db.query(`INSERT INTO variant_type_values (variant_type_id, value, display_order, is_active)
             VALUES (?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE value = VALUES(value), is_active = TRUE`, [productAttributeId, value, i]);
                }
            }
        }
        catch (error) {
            console.error('Error adding product attribute values:', error);
            throw error;
        }
    }
    generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    async getProductAttributesWithImages() {
        try {
            const allAttributes = await this.getAllProductAttributes();
            return allAttributes.filter(attr => attr.has_image);
        }
        catch (error) {
            console.error('Error getting product attributes with images:', error);
            throw error;
        }
    }
    async checkAttributeUsage(attributeName) {
        try {
            const [rows] = await database_1.db.query(`SELECT DISTINCT p.name 
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE JSON_contains_path(pv.attributes, 'one', concat('$."', ?, '"'))`, [attributeName]);
            return rows.map(row => row.name);
        }
        catch (error) {
            console.error('Error checking attribute usage:', error);
            return [];
        }
    }
    async updateAttributeValue(valueId, data) {
        try {
            const updates = [];
            const values = [];
            if (data.value !== undefined) {
                updates.push('value = ?');
                values.push(data.value);
            }
            if (data.sku_code !== undefined) {
                updates.push('sku_code = ?');
                values.push(normalizeSkuCode(data.sku_code));
            }
            if (data.color_code !== undefined) {
                updates.push('color_code = ?');
                const normalized = (typeof data.color_code === 'string' && data.color_code.trim()) ? data.color_code.trim() : null;
                values.push(normalized);
            }
            if (data.display_order !== undefined) {
                updates.push('display_order = ?');
                values.push(data.display_order);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }
            if (data.is_preselected !== undefined) {
                updates.push('is_preselected = ?');
                values.push(data.is_preselected);
            }
            if (updates.length > 0) {
                values.push(valueId);
                await database_1.db.query(`UPDATE variant_type_values SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
        }
        catch (error) {
            console.error('Error updating attribute value:', error);
            throw error;
        }
    }
    async checkAttributeValueUsage(valueId) {
        try {
            const [valueRows] = await database_1.db.query(`SELECT vtv.value, vt.name as attribute_name 
         FROM variant_type_values vtv 
         JOIN variant_types vt ON vtv.variant_type_id = vt.id 
         WHERE vtv.id = ?`, [valueId]);
            if (valueRows.length === 0)
                return [];
            const { value, attribute_name } = valueRows[0];
            const [rows] = await database_1.db.query(`SELECT DISTINCT p.name 
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE JSON_UNQUOTE(JSON_EXTRACT(pv.attributes, concat('$."', ?, '"'))) = ?`, [attribute_name, value]);
            return rows.map(row => row.name);
        }
        catch (error) {
            console.error('Error checking attribute value usage:', error);
            return [];
        }
    }
    async addAttributeValue(variantTypeId, data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO variant_type_values 
         (variant_type_id, value, sku_code, color_code, display_order, is_active, is_preselected)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                variantTypeId,
                data.value,
                normalizeSkuCode(data.sku_code),
                data.color_code || null,
                data.display_order || 0,
                data.is_active !== undefined ? data.is_active : true,
                data.is_preselected !== undefined ? data.is_preselected : false
            ]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error adding attribute value:', error);
            throw error;
        }
    }
    async deleteAttributeValue(valueId) {
        try {
            const usedByProducts = await this.checkAttributeValueUsage(valueId);
            if (usedByProducts.length > 0) {
                const topProducts = usedByProducts.slice(0, 5);
                const moreCount = usedByProducts.length - 5;
                const productList = topProducts.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '');
                const [valueRows] = await database_1.db.query('SELECT value FROM variant_type_values WHERE id = ?', [valueId]);
                const valueName = valueRows[0]?.value || 'Unknown';
                throw new Error(`Current attribute value "${valueName}" is used by products: ${productList}`);
            }
            await database_1.db.query('DELETE FROM variant_type_values WHERE id = ?', [valueId]);
        }
        catch (error) {
            console.error('Error deleting attribute value:', error);
            throw error;
        }
    }
    async updateAttributeValues(variantTypeId, values) {
        try {
            const [existingValues] = await database_1.db.query('SELECT id FROM variant_type_values WHERE variant_type_id = ?', [variantTypeId]);
            const existingIds = existingValues.map(v => v.id);
            const providedIds = values.filter(v => v.id).map(v => v.id);
            const toDelete = existingIds.filter((id) => !providedIds.includes(id));
            for (const id of toDelete) {
                await this.deleteAttributeValue(id);
            }
            for (const value of values) {
                if (value.id) {
                    await this.updateAttributeValue(value.id, value);
                }
                else {
                    await this.addAttributeValue(variantTypeId, value);
                }
            }
        }
        catch (error) {
            console.error('Error updating attribute values:', error);
            throw error;
        }
    }
    async uploadAttributeValueImage(valueId, imageUrl, thumbUrl) {
        try {
            await database_1.db.query('UPDATE variant_type_values SET image_url = ?, thumb_url = ? WHERE id = ?', [imageUrl, thumbUrl ?? null, valueId]);
        }
        catch (error) {
            console.error('Error uploading attribute value image:', error);
            throw error;
        }
    }
    async clearAttributeValueGlobalImage(valueId) {
        try {
            const [rows] = await database_1.db.query('SELECT image_url FROM variant_type_values WHERE id = ?', [valueId]);
            const imageUrl = rows[0]?.image_url ?? null;
            await database_1.db.query('UPDATE variant_type_values SET image_url = NULL, thumb_url = NULL WHERE id = ?', [valueId]);
            return imageUrl;
        }
        catch (error) {
            console.error('Error clearing global attribute value image:', error);
            throw error;
        }
    }
    async uploadProductAttributeValueImage(productId, valueId, imageUrl, thumbUrl) {
        try {
            const [existing] = await database_1.db.query('SELECT id FROM product_images WHERE product_id = ? AND attribute_value_id = ? LIMIT 1', [productId, valueId]);
            if (existing.length > 0) {
                await database_1.db.query('UPDATE product_images SET image_url = ?, thumb_url = ?, is_primary = FALSE, updated_at = NOW() WHERE id = ?', [imageUrl, thumbUrl ?? null, existing[0].id]);
            }
            else {
                await database_1.db.query(`INSERT INTO product_images (product_id, variant_id, image_url, thumb_url, attribute_value_id, is_primary, order_index)
           VALUES (?, NULL, ?, ?, ?, FALSE, 0)`, [productId, imageUrl, thumbUrl ?? null, valueId]);
            }
        }
        catch (error) {
            console.error('Error uploading product attribute value image:', error);
            throw error;
        }
    }
    async deleteAttributeValueImage(valueId) {
        try {
            await database_1.db.query('UPDATE variant_type_values SET image_url = NULL, thumb_url = NULL WHERE id = ?', [valueId]);
        }
        catch (error) {
            console.error('Error deleting attribute value image:', error);
            throw error;
        }
    }
    async deleteProductAttributeValueImage(productId, valueId) {
        try {
            const [rows] = await database_1.db.query('SELECT id, image_url FROM product_images WHERE product_id = ? AND attribute_value_id = ?', [productId, valueId]);
            if (rows.length === 0)
                return 0;
            await database_1.db.query('DELETE FROM product_images WHERE product_id = ? AND attribute_value_id = ?', [productId, valueId]);
            return rows.length;
        }
        catch (error) {
            console.error('Error deleting product attribute value image:', error);
            throw error;
        }
    }
    async getProductAttributes(productId) {
        try {
            const [rows] = await database_1.db.query(`SELECT 
          vt.id AS variant_type_id,
          vt.name,
          vt.slug,
          vt.description,
          vt.has_image,
          vt.display_order,
          vt.is_active,
          vt.created_at,
          vt.updated_at,
          pa.selected_values,
          vtv.id AS value_id,
          vtv.value AS value_text,
          vtv.color_code,
          vtv.display_order AS value_display_order,
          vtv.is_active AS value_is_active,
          vtv.is_preselected,
          vtv.created_at AS value_created_at,
          vtv.updated_at AS value_updated_at,
          vtv.image_url AS vtv_image_url,
          vtv.thumb_url AS vtv_thumb_url,
          pi.image_url AS product_image_url,
          pi.thumb_url AS product_thumb_url
        FROM product_attributes pa
        JOIN variant_types vt ON pa.variant_type_id = vt.id
        LEFT JOIN variant_type_values vtv ON vt.id = vtv.variant_type_id AND vtv.is_active = TRUE
        LEFT JOIN (
          SELECT attribute_value_id,
            ANY_VALUE(image_url) AS image_url,
            ANY_VALUE(thumb_url) AS thumb_url
          FROM product_images
          WHERE product_id = ?
            AND attribute_value_id IS NOT NULL
          GROUP BY attribute_value_id
        ) pi ON pi.attribute_value_id = vtv.id
        WHERE pa.product_id = ? AND vt.is_active = TRUE
        ORDER BY vt.display_order, vt.name, vtv.display_order, vtv.value`, [productId, productId]);
            const byType = new Map();
            for (const row of rows) {
                const typeId = row.variant_type_id;
                if (!byType.has(typeId)) {
                    let selected = [];
                    try {
                        const raw = row.selected_values;
                        selected =
                            typeof raw === 'string' ? JSON.parse(raw || '[]') : Array.isArray(raw) ? raw : [];
                    }
                    catch {
                        selected = [];
                    }
                    byType.set(typeId, {
                        id: typeId,
                        name: row.name,
                        slug: row.slug,
                        description: row.description,
                        has_image: row.has_image === 1 || row.has_image === true,
                        display_order: row.display_order,
                        is_active: row.is_active === 1 || row.is_active === true,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        values: [],
                        selected_values: selected
                    });
                }
                if (row.value_id != null) {
                    const attr = byType.get(typeId);
                    const fromProduct = row.product_image_url && String(row.product_image_url).trim();
                    const imageUrl = fromProduct
                        ? (0, productImageUrlService_1.resolveProductImageUrl)(productId, fromProduct)
                        : null;
                    const tp = row.product_thumb_url && String(row.product_thumb_url).trim();
                    const thumbUrl = imageUrl
                        ? (0, productImageUrlService_1.resolveProductThumbUrl)(productId, imageUrl, tp || null)
                        : null;
                    attr.values.push({
                        id: row.value_id,
                        variant_type_id: typeId,
                        value: row.value_text,
                        sku_code: null,
                        color_code: row.color_code || null,
                        display_order: row.value_display_order,
                        is_active: row.value_is_active === 1 || row.value_is_active === true,
                        is_preselected: row.is_preselected === 1 || row.is_preselected === true,
                        created_at: row.value_created_at,
                        updated_at: row.value_updated_at,
                        image_url: imageUrl,
                        thumb_url: thumbUrl || null
                    });
                }
            }
            return Array.from(byType.values());
        }
        catch (error) {
            console.error('Error getting product attributes:', error);
            throw error;
        }
    }
    async addProductAttribute(productId, variantTypeId) {
        try {
            await database_1.db.query('INSERT IGNORE INTO product_attributes (product_id, variant_type_id) VALUES (?, ?)', [productId, variantTypeId]);
        }
        catch (error) {
            console.error('Error adding product attribute:', error);
            throw error;
        }
    }
    async removeProductAttribute(productId, variantTypeId) {
        try {
            await database_1.db.query('DELETE FROM product_attributes WHERE product_id = ? AND variant_type_id = ?', [productId, variantTypeId]);
        }
        catch (error) {
            console.error('Error removing product attribute:', error);
            throw error;
        }
    }
    async updateProductAttributeSelection(productId, variantTypeId, selectedValues) {
        try {
            await database_1.db.query('UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?', [JSON.stringify(selectedValues), productId, variantTypeId]);
        }
        catch (error) {
            console.error('Error updating product attribute selection:', error);
            throw error;
        }
    }
    async getProductAttributeValues(productId) {
        try {
            const attributes = await this.getProductAttributes(productId);
            const result = new Map();
            for (const attr of attributes) {
                if (attr.values && attr.values.length > 0) {
                    result.set(attr.name, attr.values.map(v => v.value));
                }
            }
            return result;
        }
        catch (error) {
            console.error('Error getting product attribute values:', error);
            throw error;
        }
    }
}
exports.ProductAttributeService = ProductAttributeService;
exports.default = ProductAttributeService.getInstance();
//# sourceMappingURL=productAttributeService.js.map