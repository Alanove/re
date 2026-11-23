"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const database_1 = require("../../src/config/database");
class ReportsService {
    constructor() { }
    static getInstance() {
        if (!ReportsService.instance) {
            ReportsService.instance = new ReportsService();
        }
        return ReportsService.instance;
    }
    async getSalesReport(dateFrom, dateTo) {
        try {
            let dateFilter = '';
            const params = [];
            if (dateFrom && dateTo) {
                dateFilter = 'WHERE DATE(created_at) BETWEEN ? AND ?';
                params.push(dateFrom, dateTo);
            }
            else if (dateFrom) {
                dateFilter = 'WHERE DATE(created_at) >= ?';
                params.push(dateFrom);
            }
            else if (dateTo) {
                dateFilter = 'WHERE DATE(created_at) <= ?';
                params.push(dateTo);
            }
            const [summaryRows] = await database_1.db.query(`SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_order_value
        FROM orders ${dateFilter}`, params);
            const summary = summaryRows[0];
            const [statusRows] = await database_1.db.query(`SELECT status, COUNT(*) as count 
         FROM orders ${dateFilter}
         GROUP BY status`, params);
            const ordersByStatus = {};
            statusRows.forEach((row) => {
                ordersByStatus[row.status] = parseInt(row.count);
            });
            return {
                period: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All time',
                totalOrders: parseInt(summary.total_orders) || 0,
                totalRevenue: parseFloat(summary.total_revenue) || 0,
                averageOrderValue: parseFloat(summary.average_order_value) || 0,
                ordersByStatus
            };
        }
        catch (error) {
            console.error('Error getting sales report:', error);
            throw error;
        }
    }
    async getBestSellingProducts(limit = 10, dateFrom, dateTo) {
        try {
            let dateFilter = '';
            const params = [];
            if (dateFrom && dateTo) {
                dateFilter = 'AND DATE(o.created_at) BETWEEN ? AND ?';
                params.push(dateFrom, dateTo);
            }
            else if (dateFrom) {
                dateFilter = 'AND DATE(o.created_at) >= ?';
                params.push(dateFrom);
            }
            else if (dateTo) {
                dateFilter = 'AND DATE(o.created_at) <= ?';
                params.push(dateTo);
            }
            const [rows] = await database_1.db.query(`SELECT 
          oi.product_id,
          oi.product_name,
          SUM(oi.quantity) as total_sold,
          SUM(oi.total_price) as total_revenue,
          COUNT(DISTINCT oi.order_id) as order_count
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled' ${dateFilter}
        GROUP BY oi.product_id, oi.product_name
        ORDER BY total_sold DESC
        LIMIT ?`, [...params, limit]);
            return rows.map((row) => ({
                product_id: row.product_id,
                product_name: row.product_name,
                total_sold: parseInt(row.total_sold) || 0,
                total_revenue: parseFloat(row.total_revenue) || 0,
                order_count: parseInt(row.order_count) || 0
            }));
        }
        catch (error) {
            console.error('Error getting best selling products:', error);
            throw error;
        }
    }
    async getCustomerAnalytics(dateFrom, dateTo) {
        try {
            let dateFilter = '';
            const params = [];
            if (dateFrom && dateTo) {
                dateFilter = 'AND DATE({{col}}) BETWEEN ? AND ?';
                params.push(dateFrom, dateTo);
            }
            else if (dateFrom) {
                dateFilter = 'AND DATE({{col}}) >= ?';
                params.push(dateFrom);
            }
            else if (dateTo) {
                dateFilter = 'AND DATE({{col}}) <= ?';
                params.push(dateTo);
            }
            const df = (col) => (dateFilter ? dateFilter.replace(/\{\{col\}\}/g, col) : '');
            const [totalRows] = await database_1.db.query(`SELECT COUNT(*) as total FROM users WHERE role = 'customer' ${df('users.created_at')}`, params);
            let newCustomerDateFilter = '';
            const newCustomerParams = [];
            if (dateFrom && dateTo) {
                newCustomerDateFilter = 'AND DATE(first_order) BETWEEN ? AND ?';
                newCustomerParams.push(dateFrom, dateTo);
            }
            else if (dateFrom) {
                newCustomerDateFilter = 'AND DATE(first_order) >= ?';
                newCustomerParams.push(dateFrom);
            }
            else if (dateTo) {
                newCustomerDateFilter = 'AND DATE(first_order) <= ?';
                newCustomerParams.push(dateTo);
            }
            const [newCustomerRows] = await database_1.db.query(`SELECT COUNT(*) as new_customers
         FROM (
           SELECT customer_id, MIN(created_at) AS first_order
           FROM orders
           WHERE customer_id IS NOT NULL
           GROUP BY customer_id
         ) first_orders
         WHERE 1=1 ${newCustomerDateFilter}`, newCustomerParams);
            const [returningRows] = await database_1.db.query(`SELECT COUNT(DISTINCT customer_id) as returning_customers
         FROM orders
         WHERE customer_id IS NOT NULL
         AND customer_id IN (
           SELECT customer_id
           FROM orders
           GROUP BY customer_id
           HAVING COUNT(*) > 1
         )
         ${df('orders.created_at')}`, params);
            const [avgRows] = await database_1.db.query(`SELECT COALESCE(AVG(total_amount), 0) as avg_order_value
         FROM orders
         WHERE customer_id IS NOT NULL ${df('orders.created_at')}`, params);
            const [topCustomerRows] = await database_1.db.query(`SELECT 
          o.customer_id,
          u.email,
          COUNT(DISTINCT o.id) as total_orders,
          SUM(o.total_amount) as total_spent
        FROM orders o
        INNER JOIN users u ON o.customer_id = u.id
        WHERE o.customer_id IS NOT NULL ${df('o.created_at')}
        GROUP BY o.customer_id, u.email
        ORDER BY total_spent DESC
        LIMIT 10`, params);
            return {
                totalCustomers: parseInt(totalRows[0]?.total) || 0,
                newCustomers: parseInt(newCustomerRows[0]?.new_customers) || 0,
                returningCustomers: parseInt(returningRows[0]?.returning_customers) || 0,
                averageOrderValue: parseFloat(avgRows[0]?.avg_order_value) || 0,
                topCustomers: topCustomerRows.map((row) => ({
                    customer_id: row.customer_id,
                    email: row.email,
                    total_orders: parseInt(row.total_orders) || 0,
                    total_spent: parseFloat(row.total_spent) || 0
                }))
            };
        }
        catch (error) {
            console.error('Error getting customer analytics:', error);
            throw error;
        }
    }
    buildLowStockSearchFilter(search, productAlias, variantAlias) {
        const trimmed = search?.trim();
        if (!trimmed) {
            return { clause: '', params: [] };
        }
        const like = `%${trimmed}%`;
        const parts = [
            `${productAlias}.name LIKE ?`,
            `${productAlias}.sku LIKE ?`,
            `${productAlias}.slug LIKE ?`
        ];
        const params = [like, like, like];
        if (/^\d+$/.test(trimmed)) {
            parts.push(`${productAlias}.id = ?`);
            params.push(parseInt(trimmed, 10));
        }
        if (variantAlias) {
            parts.push(`${variantAlias}.name LIKE ?`, `${variantAlias}.sku LIKE ?`);
            params.push(like, like);
            if (/^\d+$/.test(trimmed)) {
                parts.push(`${variantAlias}.id = ?`);
                params.push(parseInt(trimmed, 10));
            }
        }
        return { clause: `AND (${parts.join(' OR ')})`, params };
    }
    async getLowStockReport(threshold = 100, search) {
        try {
            const stockThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 100;
            const productSearch = this.buildLowStockSearchFilter(search, 'p', null);
            const variantSearch = this.buildLowStockSearchFilter(search, 'p', 'pv');
            const categorySubquery = `(SELECT GROUP_CONCAT(pc.name SEPARATOR ', ')
         FROM product_category_relations pcr
         JOIN product_categories pc ON pcr.category_id = pc.id
         WHERE pcr.product_id = p.id)`;
            const [rows] = await database_1.db.query(`SELECT * FROM (
          SELECT
            'product' AS item_type,
            p.id AS product_id,
            NULL AS variant_id,
            p.name AS product_name,
            NULL AS variant_name,
            p.id AS product_number,
            p.sku,
            p.slug,
            p.stock_quantity,
            ${categorySubquery} AS category_name
          FROM products p
          WHERE p.track_inventory = TRUE
            AND p.is_active = TRUE
            AND p.stock_quantity < ?
            ${productSearch.clause}

          UNION ALL

          SELECT
            'variant' AS item_type,
            p.id AS product_id,
            pv.id AS variant_id,
            p.name AS product_name,
            pv.name AS variant_name,
            p.id AS product_number,
            COALESCE(pv.sku, p.sku) AS sku,
            p.slug,
            pv.stock_quantity,
            ${categorySubquery} AS category_name
          FROM product_variants pv
          INNER JOIN products p ON pv.product_id = p.id
          WHERE pv.track_inventory = TRUE
            AND pv.is_active = TRUE
            AND p.is_active = TRUE
            AND pv.stock_quantity < ?
            ${variantSearch.clause}
        ) low_stock_items
        ORDER BY stock_quantity ASC, product_name ASC, variant_name ASC`, [
                stockThreshold,
                ...productSearch.params,
                stockThreshold,
                ...variantSearch.params
            ]);
            return rows.map((row) => ({
                item_type: row.item_type,
                product_id: row.product_id,
                variant_id: row.variant_id ?? null,
                product_name: row.product_name,
                variant_name: row.variant_name ?? null,
                product_number: row.product_number,
                sku: row.sku ?? null,
                slug: row.slug,
                stock_quantity: parseInt(row.stock_quantity, 10) || 0,
                category_name: row.category_name ?? null
            }));
        }
        catch (error) {
            console.error('Error getting low stock report:', error);
            throw error;
        }
    }
    async getLowStockProducts(threshold) {
        try {
            const lowStockThreshold = threshold || 5;
            const [rows] = await database_1.db.query(`SELECT 
          p.id,
          p.name,
          p.sku,
          p.stock_quantity,
          p.low_stock_threshold,
          pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.track_inventory = TRUE
        AND p.stock_quantity <= COALESCE(p.low_stock_threshold, ?)
        AND p.is_active = TRUE
        ORDER BY p.stock_quantity ASC`, [lowStockThreshold]);
            return rows;
        }
        catch (error) {
            console.error('Error getting low stock products:', error);
            throw error;
        }
    }
    async getDiscountUsageReport(dateFrom, dateTo) {
        try {
            let dateFilter = '';
            const params = [];
            if (dateFrom && dateTo) {
                dateFilter = 'AND DATE(du.used_at) BETWEEN ? AND ?';
                params.push(dateFrom, dateTo);
            }
            else if (dateFrom) {
                dateFilter = 'AND DATE(du.used_at) >= ?';
                params.push(dateFrom);
            }
            else if (dateTo) {
                dateFilter = 'AND DATE(du.used_at) <= ?';
                params.push(dateTo);
            }
            const [rows] = await database_1.db.query(`SELECT 
          d.id,
          d.code,
          d.name,
          d.type,
          d.value,
          COUNT(du.id) as usage_count,
          SUM(du.discount_amount) as total_discount_amount
        FROM discounts d
        LEFT JOIN discount_usage du ON d.id = du.discount_id ${dateFilter}
        GROUP BY d.id, d.code, d.name, d.type, d.value
        ORDER BY usage_count DESC`, params);
            return rows.map((row) => ({
                ...row,
                usage_count: parseInt(row.usage_count) || 0,
                total_discount_amount: parseFloat(row.total_discount_amount) || 0
            }));
        }
        catch (error) {
            console.error('Error getting discount usage report:', error);
            throw error;
        }
    }
}
exports.ReportsService = ReportsService;
//# sourceMappingURL=reportsService.js.map