"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const database_1 = require("../config/database");
class CategoryService {
    constructor() { }
    static getInstance() {
        if (!CategoryService.instance) {
            CategoryService.instance = new CategoryService();
        }
        return CategoryService.instance;
    }
    async getCategoryById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM product_categories WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting category by ID:', error);
            throw error;
        }
    }
    async getCategoryBySlug(slug) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM product_categories WHERE slug = ?', [slug]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting category by slug:', error);
            throw error;
        }
    }
    async getAllCategories(includeInactive = false) {
        try {
            let query = 'SELECT * FROM product_categories';
            const params = [];
            if (!includeInactive) {
                query += ' WHERE is_active = TRUE';
            }
            query += ' ORDER BY order_index ASC, name ASC';
            const [rows] = await database_1.db.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error getting all categories:', error);
            throw error;
        }
    }
    async getCategoryTree(includeInactive = false) {
        try {
            const allCategories = await this.getAllCategories(includeInactive);
            const categoryMap = new Map();
            const rootCategories = [];
            for (const category of allCategories) {
                const categoryWithChildren = {
                    ...category,
                    children: []
                };
                const [countRows] = await database_1.db.query('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = TRUE AND status = ?', [category.id, 'published']);
                categoryWithChildren.product_count = countRows[0]?.count || 0;
                categoryMap.set(category.id, categoryWithChildren);
            }
            for (const category of allCategories) {
                const categoryWithChildren = categoryMap.get(category.id);
                if (category.parent_id === null) {
                    rootCategories.push(categoryWithChildren);
                }
                else {
                    const parent = categoryMap.get(category.parent_id);
                    if (parent) {
                        if (!parent.children) {
                            parent.children = [];
                        }
                        parent.children.push(categoryWithChildren);
                    }
                }
            }
            return rootCategories;
        }
        catch (error) {
            console.error('Error getting category tree:', error);
            throw error;
        }
    }
    async getFeaturedCategories(limit = 10) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM product_categories WHERE is_featured = TRUE AND is_active = TRUE ORDER BY order_index ASC, name ASC LIMIT ?`, [limit]);
            return rows;
        }
        catch (error) {
            console.error('Error getting featured categories:', error);
            throw error;
        }
    }
    async getCategoryBreadcrumbs(categoryId) {
        try {
            const breadcrumbs = [];
            let currentId = categoryId;
            while (currentId !== null) {
                const category = await this.getCategoryById(currentId);
                if (!category)
                    break;
                breadcrumbs.unshift(category);
                currentId = category.parent_id;
            }
            return breadcrumbs;
        }
        catch (error) {
            console.error('Error getting category breadcrumbs:', error);
            throw error;
        }
    }
    async getCategoryDescendantIds(categoryId) {
        try {
            const descendantIds = [categoryId];
            const getChildren = async (parentId) => {
                const [rows] = await database_1.db.query('SELECT id FROM product_categories WHERE parent_id = ?', [parentId]);
                for (const row of rows) {
                    const rowId = row.id;
                    descendantIds.push(rowId);
                    await getChildren(rowId);
                }
            };
            await getChildren(categoryId);
            return descendantIds;
        }
        catch (error) {
            console.error('Error getting category descendant IDs:', error);
            throw error;
        }
    }
    async getCategoryPath(categoryId) {
        try {
            const breadcrumbs = await this.getCategoryBreadcrumbs(categoryId);
            return breadcrumbs.map(c => c.slug).join('/');
        }
        catch (error) {
            console.error('Error getting category path:', error);
            throw error;
        }
    }
}
exports.CategoryService = CategoryService;
exports.default = CategoryService.getInstance();
//# sourceMappingURL=categoryService.js.map