"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountManagementService = void 0;
const database_1 = require("../../src/config/database");
class DiscountManagementService {
    constructor() { }
    static getInstance() {
        if (!DiscountManagementService.instance) {
            DiscountManagementService.instance = new DiscountManagementService();
        }
        return DiscountManagementService.instance;
    }
    async createDiscount(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO discounts (
          code, name, description, type, value, minimum_purchase, maximum_discount,
          usage_limit, usage_limit_per_customer, start_date, end_date, is_active,
          applies_to, product_ids, category_ids, first_time_customer_only
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                data.code.toUpperCase(),
                data.name,
                data.description || null,
                data.type,
                data.value,
                data.minimum_purchase || null,
                data.maximum_discount || null,
                data.usage_limit || null,
                data.usage_limit_per_customer || null,
                data.start_date || null,
                data.end_date || null,
                data.is_active !== undefined ? data.is_active : true,
                data.applies_to || 'all',
                data.product_ids ? JSON.stringify(data.product_ids) : null,
                data.category_ids ? JSON.stringify(data.category_ids) : null,
                data.first_time_customer_only || false
            ]);
            const discountId = result.insertId;
            const discount = await this.getDiscountById(discountId);
            if (!discount) {
                throw new Error('Failed to retrieve created discount');
            }
            return discount;
        }
        catch (error) {
            console.error('Error creating discount:', error);
            throw error;
        }
    }
    async updateDiscount(id, data) {
        try {
            const updates = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (key === 'code') {
                        updates.push('code = ?');
                        values.push(String(value).toUpperCase());
                    }
                    else if (key === 'product_ids' || key === 'category_ids') {
                        updates.push(`${key} = ?`);
                        values.push(Array.isArray(value) ? JSON.stringify(value) : value);
                    }
                    else {
                        updates.push(`${key} = ?`);
                        values.push(value);
                    }
                }
            });
            if (updates.length === 0) {
                const discount = await this.getDiscountById(id);
                if (!discount) {
                    throw new Error('Discount not found');
                }
                return discount;
            }
            values.push(id);
            await database_1.db.query(`UPDATE discounts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            const discount = await this.getDiscountById(id);
            if (!discount) {
                throw new Error('Discount not found');
            }
            return discount;
        }
        catch (error) {
            console.error('Error updating discount:', error);
            throw error;
        }
    }
    async deleteDiscount(id) {
        try {
            await database_1.db.query('DELETE FROM discounts WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting discount:', error);
            throw error;
        }
    }
    async getDiscountById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM discounts WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting discount by ID:', error);
            throw error;
        }
    }
    async getAllDiscounts(page = 1, limit = 50, filters) {
        try {
            let whereConditions = [];
            let queryParams = [];
            if (filters?.is_active !== undefined) {
                whereConditions.push('is_active = ?');
                queryParams.push(filters.is_active);
            }
            if (filters?.search) {
                whereConditions.push('(code LIKE ? OR name LIKE ?)');
                queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const [countRows] = await database_1.db.query(`SELECT COUNT(*) as count FROM discounts ${whereClause}`, queryParams);
            const total = countRows[0]?.count || 0;
            const offset = (page - 1) * limit;
            const totalPages = Math.ceil(total / limit);
            const [rows] = await database_1.db.query(`SELECT * FROM discounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
            return {
                discounts: rows,
                total,
                page,
                limit,
                totalPages
            };
        }
        catch (error) {
            console.error('Error getting all discounts:', error);
            throw error;
        }
    }
}
exports.DiscountManagementService = DiscountManagementService;
exports.default = DiscountManagementService.getInstance();
//# sourceMappingURL=discountManagementService.js.map