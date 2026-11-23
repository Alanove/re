"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const database_1 = require("../config/database");
const variantLabel_1 = require("../utils/variantLabel");
class OrderService {
    constructor() { }
    static getInstance() {
        if (!OrderService.instance) {
            OrderService.instance = new OrderService();
        }
        return OrderService.instance;
    }
    async generateOrderNumber() {
        const prefix = 'ORD';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const orderNumber = `${prefix}-${timestamp}-${random}`;
        const [rows] = await database_1.db.query('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
        if (rows.length > 0) {
            return this.generateOrderNumber();
        }
        return orderNumber;
    }
    async createOrder(orderData) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            const orderNumber = await this.generateOrderNumber();
            const [result] = await connection.query(`INSERT INTO orders (
          order_number, customer_id, customer_email, customer_phone,
          status, subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
          currency, payment_method, payment_status, shipping_method,
          shipping_address, billing_address, discount_code, notes
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`, [
                orderNumber,
                orderData.customer_id || null,
                orderData.customer_email,
                orderData.customer_phone || null,
                orderData.subtotal,
                orderData.tax_amount,
                orderData.shipping_amount,
                orderData.discount_amount,
                orderData.total_amount,
                orderData.currency || 'USD',
                orderData.payment_method,
                orderData.shipping_method || null,
                JSON.stringify(orderData.shipping_address),
                orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
                orderData.discount_code || null,
                orderData.notes || null
            ]);
            const orderId = result.insertId;
            for (const item of orderData.items) {
                const [productRows] = await connection.query('SELECT name, sku FROM products WHERE id = ?', [item.product_id]);
                const product = productRows[0];
                let variantName = null;
                let itemSku = product.sku;
                if (item.variant_id) {
                    const [variantRows] = await connection.query('SELECT name, sku, attributes FROM product_variants WHERE id = ?', [item.variant_id]);
                    if (variantRows.length > 0) {
                        const variant = variantRows[0];
                        variantName = (0, variantLabel_1.buildOrderVariantName)(variant, product.name);
                        itemSku = variant.sku || itemSku;
                    }
                }
                await connection.query(`INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, variant_name, sku,
            quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    orderId,
                    item.product_id,
                    item.variant_id || null,
                    product.name,
                    variantName,
                    itemSku,
                    item.quantity,
                    item.unit_price,
                    item.unit_price * item.quantity
                ]);
                if (item.variant_id) {
                    await connection.query(`UPDATE product_variants 
            SET stock_quantity = stock_quantity - ? 
            WHERE id = ? AND track_inventory = TRUE`, [item.quantity, item.variant_id]);
                }
                else {
                    await connection.query(`UPDATE products 
            SET stock_quantity = stock_quantity - ? 
            WHERE id = ? AND track_inventory = TRUE`, [item.quantity, item.product_id]);
                }
            }
            await connection.query('INSERT INTO order_status_history (order_id, status) VALUES (?, ?)', [orderId, 'pending']);
            await connection.commit();
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new Error('Failed to retrieve created order');
            }
            return order;
        }
        catch (error) {
            await connection.rollback();
            console.error('Error creating order:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async getOrderById(orderId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting order by ID:', error);
            throw error;
        }
    }
    async getOrderByNumber(orderNumber) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting order by number:', error);
            throw error;
        }
    }
    async getOrderWithItems(orderId) {
        try {
            const order = await this.getOrderById(orderId);
            if (!order)
                return null;
            const items = await this.getOrderItems(orderId);
            return {
                ...order,
                items,
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
    async getOrderItems(orderId) {
        try {
            const [rows] = await database_1.db.query(`SELECT oi.*, pv.attributes AS variant_attributes, pv.sku AS variant_sku
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`, [orderId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting order items:', error);
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
    async updatePaymentStatus(orderId, paymentStatus) {
        try {
            await database_1.db.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', [paymentStatus, orderId]);
        }
        catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }
    async addOrderNote(orderId, note) {
        try {
            await database_1.db.query('UPDATE orders SET notes = CONCAT(COALESCE(notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?', [note, orderId]);
        }
        catch (error) {
            console.error('Error adding order note:', error);
            throw error;
        }
    }
    async attachOrderToCustomer(orderId, customerId) {
        try {
            const [result] = await database_1.db.query('UPDATE orders SET customer_id = ?, updated_at = NOW() WHERE id = ? AND customer_id IS NULL', [customerId, orderId]);
            return (result.affectedRows ?? 0) > 0;
        }
        catch (error) {
            console.error('Error attaching order to customer:', error);
            throw error;
        }
    }
    async attachGuestOrdersToCustomer(customerId, email) {
        if (!email || typeof email !== 'string')
            return 0;
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail)
            return 0;
        try {
            const [result] = await database_1.db.query(`UPDATE orders SET customer_id = ?, updated_at = NOW() 
         WHERE customer_id IS NULL AND LOWER(TRIM(customer_email)) = ?`, [customerId, normalizedEmail]);
            return result.affectedRows ?? 0;
        }
        catch (error) {
            console.error('Error attaching guest orders to customer:', error);
            throw error;
        }
    }
    async getCustomerOrders(customerId, limit = 50) {
        try {
            const [rows] = await database_1.db.query(`SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count 
         FROM orders o 
         WHERE o.customer_id = ? 
         ORDER BY o.created_at DESC 
         LIMIT ?`, [customerId, limit]);
            return rows;
        }
        catch (error) {
            console.error('Error getting customer orders:', error);
            throw error;
        }
    }
    async getOrderStatusHistory(orderId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [orderId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting order status history:', error);
            throw error;
        }
    }
}
exports.OrderService = OrderService;
exports.default = OrderService.getInstance();
//# sourceMappingURL=orderService.js.map