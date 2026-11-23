"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryManagementService = void 0;
const database_1 = require("../../src/config/database");
class CategoryManagementService {
    constructor() { }
    static getInstance() {
        if (!CategoryManagementService.instance) {
            CategoryManagementService.instance = new CategoryManagementService();
        }
        return CategoryManagementService.instance;
    }
    async createCategory(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO product_categories (
          name, slug, description, parent_id, image_url, thumb_url, is_featured, order_index,
          meta_title, meta_description, meta_keywords, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                data.name,
                data.slug,
                data.description || null,
                data.parent_id || null,
                data.image_url || null,
                data.thumb_url || null,
                data.is_featured || false,
                data.order_index || 0,
                data.meta_title || null,
                data.meta_description || null,
                data.meta_keywords || null,
                data.is_active !== undefined ? data.is_active : true
            ]);
            const categoryId = result.insertId;
            const category = await this.getCategoryById(categoryId);
            if (!category) {
                throw new Error('Failed to retrieve created category');
            }
            return category;
        }
        catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }
    async updateCategory(id, data) {
        try {
            const updates = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            });
            if (updates.length === 0) {
                const category = await this.getCategoryById(id);
                if (!category) {
                    throw new Error('Category not found');
                }
                return category;
            }
            values.push(id);
            await database_1.db.query(`UPDATE product_categories SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            const category = await this.getCategoryById(id);
            if (!category) {
                throw new Error('Category not found');
            }
            return category;
        }
        catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    }
    async deleteCategory(id) {
        try {
            const [childrenRows] = await database_1.db.query('SELECT id FROM product_categories WHERE parent_id = ?', [id]);
            if (childrenRows.length > 0) {
                throw new Error('Cannot delete category with subcategories');
            }
            const [productRows] = await database_1.db.query('SELECT id FROM products WHERE category_id = ? LIMIT 1', [id]);
            if (productRows.length > 0) {
                throw new Error('Cannot delete category with products');
            }
            await database_1.db.query('DELETE FROM product_categories WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }
    async getCategoryById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM product_categories WHERE id = ?', [id]);
            if (rows.length > 0) {
                const row = rows[0];
                if (row.image_url) {
                    row.image_url = row.image_url.replace(/\\/g, '/');
                    if (!row.image_url.startsWith('/')) {
                        row.image_url = '/' + row.image_url;
                    }
                    row.image_url = row.image_url.replace(/\/+/g, '/');
                }
                return row;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting category by ID:', error);
            throw error;
        }
    }
    async getAllCategories(includeInactive = false) {
        try {
            let query = `
        SELECT c.*, 
               pc.name as parent_name
        FROM product_categories c
        LEFT JOIN product_categories pc ON c.parent_id = pc.id
      `;
            const params = [];
            if (!includeInactive) {
                query += ' WHERE c.is_active = TRUE';
            }
            query += ' ORDER BY c.order_index ASC, c.name ASC';
            const [rows] = await database_1.db.query(query, params);
            return rows.map((row) => {
                if (row.image_url) {
                    row.image_url = row.image_url.replace(/\\/g, '/');
                    if (!row.image_url.startsWith('/')) {
                        row.image_url = '/' + row.image_url;
                    }
                    row.image_url = row.image_url.replace(/\/+/g, '/');
                }
                return row;
            });
        }
        catch (error) {
            console.error('Error getting all categories:', error);
            throw error;
        }
    }
    async updateCategoryOrder(updates) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            for (const update of updates) {
                await connection.query('UPDATE product_categories SET order_index = ? WHERE id = ?', [update.order_index, update.id]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error updating category order:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
}
exports.CategoryManagementService = CategoryManagementService;
exports.default = CategoryManagementService.getInstance();
//# sourceMappingURL=categoryManagementService.js.map