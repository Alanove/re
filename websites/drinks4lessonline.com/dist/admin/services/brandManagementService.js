"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandManagementService = void 0;
const database_1 = require("../../src/config/database");
class BrandManagementService {
    constructor() { }
    static getInstance() {
        if (!BrandManagementService.instance) {
            BrandManagementService.instance = new BrandManagementService();
        }
        return BrandManagementService.instance;
    }
    async getAllBrands(includeInactive = false) {
        try {
            const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
            const [rows] = await database_1.db.query(`SELECT * FROM brands ${whereClause} ORDER BY display_order ASC, name ASC`);
            const list = Array.isArray(rows) ? rows : [];
            return list.map((row) => ({
                ...row,
                is_featured: row.is_featured === 1 || row.is_featured === true,
                is_active: row.is_active === 1 || row.is_active === true
            }));
        }
        catch (error) {
            console.error('Error getting brands:', error);
            throw error;
        }
    }
    async getBrandById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM brands WHERE id = ?', [id]);
            if (rows.length === 0)
                return null;
            const brand = rows[0];
            return {
                ...brand,
                is_featured: brand.is_featured === 1 || brand.is_featured === true,
                is_active: brand.is_active === 1 || brand.is_active === true
            };
        }
        catch (error) {
            console.error('Error getting brand:', error);
            throw error;
        }
    }
    async getBrandBySlug(slug) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM brands WHERE slug = ?', [slug]);
            if (rows.length === 0)
                return null;
            const brand = rows[0];
            return {
                ...brand,
                is_featured: brand.is_featured === 1 || brand.is_featured === true,
                is_active: brand.is_active === 1 || brand.is_active === true
            };
        }
        catch (error) {
            console.error('Error getting brand by slug:', error);
            throw error;
        }
    }
    async createBrand(data) {
        try {
            const slug = data.slug || this.generateSlug(data.name);
            const [result] = await database_1.db.query(`INSERT INTO brands (
          name, slug, description, logo_url, website_url, is_featured, 
          display_order, is_active, meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                data.name,
                slug,
                data.description || null,
                data.logo_url || null,
                data.website_url || null,
                data.is_featured || false,
                data.display_order || 0,
                data.is_active !== undefined ? data.is_active : true,
                data.meta_title || null,
                data.meta_description || null,
                data.meta_keywords || null
            ]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error creating brand:', error);
            throw error;
        }
    }
    async updateBrand(id, data) {
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
            if (data.logo_url !== undefined) {
                updates.push('logo_url = ?');
                values.push(data.logo_url);
            }
            if (data.website_url !== undefined) {
                updates.push('website_url = ?');
                values.push(data.website_url);
            }
            if (data.is_featured !== undefined) {
                updates.push('is_featured = ?');
                values.push(data.is_featured);
            }
            if (data.display_order !== undefined) {
                updates.push('display_order = ?');
                values.push(data.display_order);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }
            if (data.meta_title !== undefined) {
                updates.push('meta_title = ?');
                values.push(data.meta_title);
            }
            if (data.meta_description !== undefined) {
                updates.push('meta_description = ?');
                values.push(data.meta_description);
            }
            if (data.meta_keywords !== undefined) {
                updates.push('meta_keywords = ?');
                values.push(data.meta_keywords);
            }
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE brands SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
        }
        catch (error) {
            console.error('Error updating brand:', error);
            throw error;
        }
    }
    async deleteBrand(id) {
        try {
            await database_1.db.query('DELETE FROM brands WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting brand:', error);
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
    async getFeaturedBrands() {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM brands 
         WHERE is_featured = TRUE AND is_active = TRUE 
         ORDER BY display_order ASC, name ASC`);
            return rows.map((row) => ({
                ...row,
                is_featured: row.is_featured === 1 || row.is_featured === true,
                is_active: row.is_active === 1 || row.is_active === true
            }));
        }
        catch (error) {
            console.error('Error getting featured brands:', error);
            throw error;
        }
    }
}
exports.BrandManagementService = BrandManagementService;
//# sourceMappingURL=brandManagementService.js.map