"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerManagementService = void 0;
const database_1 = require("../../src/config/database");
class CustomerManagementService {
    constructor() { }
    static getInstance() {
        if (!CustomerManagementService.instance) {
            CustomerManagementService.instance = new CustomerManagementService();
        }
        return CustomerManagementService.instance;
    }
    async getAllCustomers(page = 1, limit = 50, filters) {
        try {
            let whereConditions = ["role = 'customer'"];
            let queryParams = [];
            if (filters?.search) {
                whereConditions.push('(u.email LIKE ? OR u.username LIKE ?)');
                queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
            }
            if (filters?.status) {
                whereConditions.push('u.status = ?');
                queryParams.push(filters.status);
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const [countRows] = await database_1.db.query(`SELECT COUNT(*) as count FROM users u ${whereClause}`, queryParams);
            const total = countRows[0]?.count || 0;
            const offset = (page - 1) * limit;
            const totalPages = Math.ceil(total / limit);
            const [rows] = await database_1.db.query(`SELECT 
          u.id,
          u.username,
          u.email,
          u.status,
          u.role,
          u.created_at,
          u.updated_at,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.customer_id
        ${whereClause}
        GROUP BY u.id, u.username, u.email, u.status, u.role, u.created_at, u.updated_at
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
            return {
                customers: rows.map((row) => ({
                    ...row,
                    total_orders: parseInt(row.total_orders) || 0,
                    total_spent: parseFloat(row.total_spent) || 0,
                    last_order_date: row.last_order_date || null
                })),
                total,
                page,
                limit,
                totalPages
            };
        }
        catch (error) {
            console.error('Error getting all customers:', error);
            throw error;
        }
    }
    async getCustomerById(id) {
        try {
            const [rows] = await database_1.db.query(`SELECT 
          u.*,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.customer_id
        WHERE u.id = ? AND u.role = 'customer'
        GROUP BY u.id`, [id]);
            if (rows.length > 0) {
                const row = rows[0];
                return {
                    ...row,
                    total_orders: parseInt(row.total_orders) || 0,
                    total_spent: parseFloat(row.total_spent) || 0,
                    last_order_date: row.last_order_date || null
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error getting customer by ID:', error);
            throw error;
        }
    }
    async getCustomerOrders(customerId) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM orders 
         WHERE customer_id = ? 
         ORDER BY created_at DESC`, [customerId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting customer orders:', error);
            throw error;
        }
    }
    async getCustomerAddresses(customerId) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM customer_addresses 
         WHERE customer_id = ? 
         ORDER BY is_default DESC, created_at DESC`, [customerId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting customer addresses:', error);
            throw error;
        }
    }
    async updateCustomerStatus(customerId, status) {
        try {
            await database_1.db.query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND role = ?', [status, customerId, 'customer']);
        }
        catch (error) {
            console.error('Error updating customer status:', error);
            throw error;
        }
    }
}
exports.CustomerManagementService = CustomerManagementService;
//# sourceMappingURL=customerManagementService.js.map