"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderManagementService = void 0;
const database_1 = require("../../src/config/database");
const variantLabel_1 = require("../../src/utils/variantLabel");
class OrderManagementService {
    constructor() { }
    static getInstance() {
        if (!OrderManagementService.instance) {
            OrderManagementService.instance = new OrderManagementService();
        }
        return OrderManagementService.instance;
    }
    async getAllOrders(page = 1, limit = 50, filters) {
        try {
            let whereConditions = [];
            let queryParams = [];
            if (filters?.status) {
                whereConditions.push('status = ?');
                queryParams.push(filters.status);
            }
            if (filters?.payment_status) {
                whereConditions.push('payment_status = ?');
                queryParams.push(filters.payment_status);
            }
            if (filters?.payment_type) {
                whereConditions.push('LOWER(payment_method) = ?');
                queryParams.push(filters.payment_type.toLowerCase());
            }
            if (filters?.customer_id) {
                whereConditions.push('customer_id = ?');
                queryParams.push(filters.customer_id);
            }
            if (filters?.date_from) {
                whereConditions.push('DATE(created_at) >= ?');
                queryParams.push(filters.date_from);
            }
            if (filters?.date_to) {
                whereConditions.push('DATE(created_at) <= ?');
                queryParams.push(filters.date_to);
            }
            if (filters?.search) {
                whereConditions.push('(order_number LIKE ? OR customer_email LIKE ?)');
                queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const [countRows] = await database_1.db.query(`SELECT COUNT(*) as count FROM orders ${whereClause}`, queryParams);
            const total = countRows[0]?.count || 0;
            const offset = (page - 1) * limit;
            const totalPages = Math.ceil(total / limit);
            const [rows] = await database_1.db.query(`SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count FROM orders o ${whereClause.replace(/\borders\b/g, 'o')} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
            return {
                orders: rows,
                total,
                page,
                limit,
                totalPages
            };
        }
        catch (error) {
            console.error('Error getting all orders:', error);
            throw error;
        }
    }
    async getOrderWithItems(orderId) {
        try {
            const [orderRows] = await database_1.db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (orderRows.length === 0) {
                return null;
            }
            const order = orderRows[0];
            const [itemRows] = await database_1.db.query(`SELECT oi.*, pv.attributes AS variant_attributes, pv.sku AS variant_sku
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`, [orderId]);
            return {
                ...order,
                items: itemRows,
                shipping_address: typeof order.shipping_address === 'string'
                    ? JSON.parse(order.shipping_address)
                    : order.shipping_address,
                billing_address: order.billing_address && typeof order.billing_address === 'string'
                    ? JSON.parse(order.billing_address)
                    : order.billing_address
            };
        }
        catch (error) {
            console.error('Error getting order with items:', error);
            throw error;
        }
    }
    async updateOrderStatus(orderId, status, userId, notes) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
            await connection.query('INSERT INTO order_status_history (order_id, status, notes, created_by) VALUES (?, ?, ?, ?)', [orderId, status, notes || null, userId || null]);
            if (status === 'shipped') {
                await connection.query('UPDATE orders SET shipped_at = NOW() WHERE id = ?', [orderId]);
            }
            else if (status === 'delivered') {
                await connection.query('UPDATE orders SET delivered_at = NOW() WHERE id = ?', [orderId]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error updating order status:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async addOrderNote(orderId, note, isInternal = false) {
        try {
            if (isInternal) {
                await database_1.db.query('UPDATE orders SET internal_notes = CONCAT(COALESCE(internal_notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?', [note, orderId]);
            }
            else {
                await database_1.db.query('UPDATE orders SET notes = CONCAT(COALESCE(notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?', [note, orderId]);
            }
        }
        catch (error) {
            console.error('Error adding order note:', error);
            throw error;
        }
    }
    async updateOrderNotes(orderId, internalNotes) {
        try {
            await database_1.db.query('UPDATE orders SET internal_notes = ?, updated_at = NOW() WHERE id = ?', [internalNotes || null, orderId]);
        }
        catch (error) {
            console.error('Error updating order notes:', error);
            throw error;
        }
    }
    async updateOrderTracking(orderId, trackingNumber, waybillLabelUrl) {
        try {
            await database_1.db.query('UPDATE orders SET tracking_number = ?, waybill_label_url = ?, updated_at = NOW() WHERE id = ?', [trackingNumber, waybillLabelUrl ?? null, orderId]);
        }
        catch (error) {
            console.error('Error updating order tracking:', error);
            throw error;
        }
    }
    async updatePaymentStatus(orderId, paymentStatus) {
        try {
            await database_1.db.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', [paymentStatus, orderId]);
        }
        catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }
    isCashOnDelivery(order) {
        const raw = order.payment_method;
        if (raw == null || raw === '')
            return false;
        const pm = String(raw).trim().toLowerCase();
        if (pm === 'cash_on_delivery' || pm === 'cod')
            return true;
        if (pm.includes('cash') || pm.includes('cod'))
            return true;
        if (pm.includes('on delivery'))
            return true;
        return false;
    }
    async getProductsWithVariantsForOrder(search) {
        try {
            let whereClause = "WHERE p.is_active = TRUE AND p.status = 'published'";
            const params = [];
            if (search && search.trim()) {
                whereClause += " AND (p.name LIKE ? OR p.sku LIKE ?)";
                params.push(`%${search.trim()}%`, `%${search.trim()}%`);
            }
            const [rows] = await database_1.db.query(`SELECT p.id, p.name, p.sku, p.price
         FROM products p ${whereClause}
         ORDER BY p.name ASC
         LIMIT 100`, params);
            const result = [];
            for (const p of rows) {
                const [varRows] = await database_1.db.query('SELECT id, name, sku, price FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY is_default DESC, id ASC', [p.id]);
                let variants;
                if (varRows.length > 0) {
                    variants = varRows.map((v) => ({
                        id: v.id,
                        name: v.name || '',
                        sku: v.sku || null,
                        price: parseFloat(v.price) || 0
                    }));
                }
                else {
                    variants = [{ id: null, name: 'Default', sku: p.sku, price: parseFloat(p.price) || 0 }];
                }
                result.push({
                    id: p.id,
                    name: p.name,
                    sku: p.sku || null,
                    variants
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error getting products for order edit:', error);
            throw error;
        }
    }
    async updateOrderCart(orderId, items, shippingAmount) {
        const connection = await database_1.db.getConnection();
        try {
            const [orderRows] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (orderRows.length === 0) {
                throw new Error('Order not found');
            }
            const order = orderRows[0];
            const isCOD = this.isCashOnDelivery(order);
            if (!isCOD) {
                throw new Error('Cart can only be edited for cash on delivery orders');
            }
            await connection.beginTransaction();
            const [currentRows] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
            const currentItems = currentRows;
            const currentById = new Map(currentItems.map(i => [i.id, i]));
            const incomingIds = new Set(items.filter(i => i.id != null).map(i => i.id));
            for (const cur of currentItems) {
                const incoming = items.find(i => i.id === cur.id);
                const newQty = incoming ? incoming.quantity : 0;
                const delta = cur.quantity - newQty;
                if (delta <= 0)
                    continue;
                const qtyToRestore = delta;
                if (cur.variant_id) {
                    await connection.query(`UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`, [qtyToRestore, cur.variant_id]);
                }
                else {
                    await connection.query(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`, [qtyToRestore, cur.product_id]);
                }
            }
            for (const cur of currentItems) {
                if (!incomingIds.has(cur.id)) {
                    if (cur.quantity > 0) {
                        if (cur.variant_id) {
                            await connection.query(`UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`, [cur.quantity, cur.variant_id]);
                        }
                        else {
                            await connection.query(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`, [cur.quantity, cur.product_id]);
                        }
                    }
                    await connection.query('DELETE FROM order_items WHERE id = ?', [cur.id]);
                }
            }
            let newSubtotal = 0;
            for (const it of items) {
                const total_price = it.unit_price * it.quantity;
                newSubtotal += total_price;
                if (it.id != null && incomingIds.has(it.id)) {
                    await connection.query('UPDATE order_items SET quantity = ?, unit_price = ?, total_price = ? WHERE id = ?', [it.quantity, it.unit_price, total_price, it.id]);
                    const cur = currentById.get(it.id);
                    if (cur && it.quantity > cur.quantity) {
                        const delta = it.quantity - cur.quantity;
                        if (cur.variant_id) {
                            await connection.query(`UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`, [delta, cur.variant_id]);
                        }
                        else {
                            await connection.query(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`, [delta, cur.product_id]);
                        }
                    }
                }
                else if (it.id == null) {
                    const [productRows] = await connection.query('SELECT name, sku FROM products WHERE id = ?', [it.product_id]);
                    const product = productRows[0];
                    let variantName = null;
                    let sku = product?.sku || null;
                    if (it.variant_id) {
                        const [vRows] = await connection.query('SELECT name, sku, attributes FROM product_variants WHERE id = ?', [it.variant_id]);
                        if (vRows[0]) {
                            variantName = (0, variantLabel_1.buildOrderVariantName)(vRows[0], product?.name || '');
                            sku = vRows[0].sku || sku;
                        }
                    }
                    await connection.query(`INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, total_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [orderId, it.product_id, it.variant_id, product?.name || '', variantName, sku, it.quantity, it.unit_price, total_price]);
                    if (it.quantity > 0) {
                        if (it.variant_id) {
                            await connection.query(`UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`, [it.quantity, it.variant_id]);
                        }
                        else {
                            await connection.query(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`, [it.quantity, it.product_id]);
                        }
                    }
                }
            }
            const discountAmount = parseFloat(order.discount_amount) || 0;
            const taxAmount = parseFloat(order.tax_amount) || 0;
            const newShipping = shippingAmount != null && !isNaN(Number(shippingAmount)) ? Number(shippingAmount) : parseFloat(order.shipping_amount) || 0;
            const newTotal = newSubtotal - discountAmount + newShipping + taxAmount;
            await connection.query('UPDATE orders SET subtotal = ?, shipping_amount = ?, total_amount = ?, updated_at = NOW() WHERE id = ?', [newSubtotal, newShipping, newTotal, orderId]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error updating order cart:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async getOrderStatistics(dateFrom, dateTo) {
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
            const [statsRows] = await database_1.db.query(`SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders ${dateFilter}`, params);
            const [statusRows] = await database_1.db.query(`SELECT status, COUNT(*) as count FROM orders ${dateFilter} GROUP BY status`, params);
            const ordersByStatus = {};
            statusRows.forEach((row) => {
                ordersByStatus[row.status] = row.count;
            });
            const statsRow = statsRows[0];
            return {
                totalOrders: statsRow?.total_orders || 0,
                totalRevenue: parseFloat(statsRow?.total_revenue?.toString() || '0'),
                averageOrderValue: parseFloat(statsRow?.avg_order_value?.toString() || '0'),
                ordersByStatus
            };
        }
        catch (error) {
            console.error('Error getting order statistics:', error);
            return {
                totalOrders: 0,
                totalRevenue: 0,
                averageOrderValue: 0,
                ordersByStatus: {}
            };
        }
    }
}
exports.OrderManagementService = OrderManagementService;
exports.default = OrderManagementService.getInstance();
//# sourceMappingURL=orderManagementService.js.map