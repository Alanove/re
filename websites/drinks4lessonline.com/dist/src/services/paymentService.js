"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const database_1 = require("../config/database");
class PaymentService {
    constructor() {
        this.gateways = new Map();
        this.initializeGateways();
    }
    initializeGateways() {
        const CashOnDeliveryService = require('./paymentGateways/cashOnDeliveryService').default;
        this.registerGateway('cash_on_delivery', new CashOnDeliveryService());
        const NetCommerceService = require('./paymentGateways/netcommerceService').default;
        const netcommerce = new NetCommerceService();
        this.registerGateway('netcommerce', netcommerce);
    }
    static getInstance() {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService();
        }
        return PaymentService.instance;
    }
    registerGateway(code, gateway) {
        this.gateways.set(code, gateway);
    }
    isLebanon(countryCode) {
        if (!countryCode || typeof countryCode !== 'string')
            return false;
        const c = countryCode.trim().toUpperCase();
        return c === 'LB' || c === 'LEBANON';
    }
    async getActivePaymentMethods(countryCode) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY order_index ASC, id ASC');
            let filtered = rows.filter((method) => {
                if (!countryCode)
                    return true;
                let config = method.config;
                if (typeof config === 'string') {
                    try {
                        config = JSON.parse(config);
                    }
                    catch (e) {
                        config = {};
                    }
                }
                if (config && Array.isArray(config.allowedCountries) && config.allowedCountries.length > 0) {
                    return config.allowedCountries.includes(countryCode.toUpperCase());
                }
                return true;
            });
            filtered = filtered.filter((method) => method.code === 'cash_on_delivery');
            return filtered;
        }
        catch (error) {
            console.error('Error getting active payment methods:', error);
            throw error;
        }
    }
    async getPaymentMethodByCode(code) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM payment_methods WHERE code = ? AND is_active = TRUE', [code]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting payment method by code:', error);
            throw error;
        }
    }
    async getPaymentMethodById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM payment_methods WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting payment method by id:', error);
            throw error;
        }
    }
    async processPayment(data) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            const [methodRows] = await connection.query('SELECT * FROM payment_methods WHERE id = ?', [data.paymentMethodId]);
            if (methodRows.length === 0) {
                throw new Error('Payment method not found');
            }
            const paymentMethod = methodRows[0];
            if (paymentMethod.type === 'manual') {
                const [result] = await connection.query(`INSERT INTO transactions (
            order_id, payment_method_id, amount, currency, status
          ) VALUES (?, ?, ?, ?, 'pending')`, [data.orderId, data.paymentMethodId, data.amount, data.currency]);
                await connection.commit();
                return {
                    success: true,
                    transactionId: result.insertId.toString()
                };
            }
            if (paymentMethod.type === 'gateway') {
                const gateway = this.gateways.get(paymentMethod.code);
                if (!gateway) {
                    throw new Error(`Payment gateway ${paymentMethod.code} not registered`);
                }
                const result = await gateway.processPayment(data);
                const isHostedCheckoutRedirect = result.success && !!result.redirectUrl;
                const gatewayResponseToStore = result.gatewayResponse
                    ? { ...result.gatewayResponse, gatewayOrderId: result.gatewayOrderId ?? result.gatewayResponse?.order?.id }
                    : null;
                const [transResult] = await connection.query(`INSERT INTO transactions (
            order_id, payment_method_id, transaction_id, amount, currency, 
            status, gateway_response
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    data.orderId,
                    data.paymentMethodId,
                    result.transactionId || result.sessionId || null,
                    data.amount,
                    data.currency,
                    isHostedCheckoutRedirect ? 'pending' : (result.success ? 'completed' : 'failed'),
                    gatewayResponseToStore ? JSON.stringify(gatewayResponseToStore) : null
                ]);
                if (result.success && !isHostedCheckoutRedirect) {
                    await connection.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['paid', data.orderId]);
                }
                else if (!result.success) {
                    await connection.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['failed', data.orderId]);
                    await connection.query('UPDATE transactions SET failure_reason = ? WHERE id = ?', [result.error || 'Payment failed', transResult.insertId]);
                }
                await connection.commit();
                return {
                    ...result,
                    transactionId: transResult.insertId.toString()
                };
            }
            throw new Error('Unknown payment method type');
        }
        catch (error) {
            await connection.rollback();
            console.error('Error processing payment:', error);
            return {
                success: false,
                error: error.message || 'Payment processing failed'
            };
        }
        finally {
            connection.release();
        }
    }
    async recordTransaction(orderId, paymentMethodId, amount, currency, status = 'pending', transactionId, gatewayResponse) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO transactions (
          order_id, payment_method_id, transaction_id, amount, currency, 
          status, gateway_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                orderId,
                paymentMethodId,
                transactionId || null,
                amount,
                currency,
                status,
                gatewayResponse ? JSON.stringify(gatewayResponse) : null
            ]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error recording transaction:', error);
            throw error;
        }
    }
    async getTransaction(transactionId) {
        try {
            const [rows] = await database_1.db.query(`SELECT t.*, pm.name as payment_method_name, pm.code as payment_method_code
        FROM transactions t
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.id = ?`, [transactionId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting transaction:', error);
            throw error;
        }
    }
    async getOrderTransactions(orderId) {
        try {
            const [rows] = await database_1.db.query(`SELECT t.*, pm.name as payment_method_name, pm.code as payment_method_code
        FROM transactions t
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.order_id = ?
        ORDER BY t.created_at DESC`, [orderId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting order transactions:', error);
            throw error;
        }
    }
    async initializeDefaultPaymentMethods() {
        try {
            const [existing] = await database_1.db.query('SELECT id FROM payment_methods LIMIT 1');
            if (existing.length > 0) {
                return;
            }
            await database_1.db.query(`INSERT INTO payment_methods (name, code, type, description, is_active, order_index)
        VALUES (?, ?, ?, ?, ?, ?)`, [
                'Cash on Delivery',
                'cash_on_delivery',
                'manual',
                'Pay with cash when your order is delivered',
                true,
                1
            ]);
            await database_1.db.query(`INSERT INTO payment_methods (name, code, type, description, config, is_active, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                'Pay with bank card',
                'netcommerce',
                'gateway',
                'Pay with bank card',
                JSON.stringify({ testMode: true }),
                true,
                2
            ]);
        }
        catch (error) {
            console.error('Error initializing default payment methods:', error);
        }
    }
}
exports.PaymentService = PaymentService;
exports.default = PaymentService.getInstance();
//# sourceMappingURL=paymentService.js.map