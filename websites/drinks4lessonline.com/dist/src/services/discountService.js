"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountService = void 0;
const database_1 = require("../config/database");
class DiscountService {
    constructor() { }
    static getInstance() {
        if (!DiscountService.instance) {
            DiscountService.instance = new DiscountService();
        }
        return DiscountService.instance;
    }
    async getDiscountByCode(code) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM discounts WHERE code = ?', [code.toUpperCase()]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting discount by code:', error);
            throw error;
        }
    }
    async validateDiscountCode(code, subtotal, customerId, productIds, categoryIds) {
        try {
            const discount = await this.getDiscountByCode(code);
            if (!discount) {
                return {
                    valid: false,
                    error: 'Invalid discount code'
                };
            }
            if (!discount.is_active) {
                return {
                    valid: false,
                    error: 'Discount code is not active'
                };
            }
            const now = new Date();
            if (discount.start_date && new Date(discount.start_date) > now) {
                return {
                    valid: false,
                    error: 'Discount code is not yet valid'
                };
            }
            if (discount.end_date && new Date(discount.end_date) < now) {
                return {
                    valid: false,
                    error: 'Discount code has expired'
                };
            }
            if (discount.usage_limit !== null && discount.used_count >= discount.usage_limit) {
                return {
                    valid: false,
                    error: 'Discount code has reached its usage limit'
                };
            }
            if (discount.minimum_purchase !== null && subtotal < discount.minimum_purchase) {
                return {
                    valid: false,
                    error: `Minimum purchase of ${discount.minimum_purchase} required`
                };
            }
            if (customerId && discount.usage_limit_per_customer !== null) {
                const [usageRows] = await database_1.db.query('SELECT COUNT(*) as count FROM discount_usage WHERE discount_id = ? AND customer_id = ?', [discount.id, customerId]);
                if (usageRows[0]?.count >= discount.usage_limit_per_customer) {
                    return {
                        valid: false,
                        error: 'You have already used this discount code'
                    };
                }
            }
            if (discount.first_time_customer_only && customerId) {
                const [orderRows] = await database_1.db.query('SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND payment_status = ?', [customerId, 'paid']);
                if (orderRows[0]?.count > 0) {
                    return {
                        valid: false,
                        error: 'This discount is only available for first-time customers'
                    };
                }
            }
            if (discount.applies_to === 'products' && productIds) {
                const discountProductIds = discount.product_ids
                    ? JSON.parse(discount.product_ids)
                    : [];
                const hasMatchingProduct = productIds.some(id => discountProductIds.includes(id));
                if (!hasMatchingProduct) {
                    return {
                        valid: false,
                        error: 'Discount code does not apply to items in your cart'
                    };
                }
            }
            if (discount.applies_to === 'categories' && categoryIds) {
                const discountCategoryIds = discount.category_ids
                    ? JSON.parse(discount.category_ids)
                    : [];
                const hasMatchingCategory = categoryIds.some(id => discountCategoryIds.includes(id));
                if (!hasMatchingCategory) {
                    return {
                        valid: false,
                        error: 'Discount code does not apply to items in your cart'
                    };
                }
            }
            let discountAmount = 0;
            if (discount.type === 'percentage') {
                discountAmount = (subtotal * discount.value) / 100;
                if (discount.maximum_discount !== null && discountAmount > discount.maximum_discount) {
                    discountAmount = discount.maximum_discount;
                }
            }
            else {
                discountAmount = discount.value;
                if (discountAmount > subtotal) {
                    discountAmount = subtotal;
                }
            }
            return {
                valid: true,
                discount,
                discountAmount
            };
        }
        catch (error) {
            console.error('Error validating discount code:', error);
            return {
                valid: false,
                error: 'Error validating discount code'
            };
        }
    }
    async calculateDiscount(code, subtotal, customerId, productIds, categoryIds) {
        const validation = await this.validateDiscountCode(code, subtotal, customerId, productIds, categoryIds);
        if (!validation.valid || !validation.discount || validation.discountAmount === undefined) {
            return null;
        }
        return {
            discountAmount: validation.discountAmount,
            finalTotal: subtotal - validation.discountAmount,
            discount: validation.discount
        };
    }
    async recordDiscountUsage(discountId, orderId, customerId, discountAmount) {
        const connection = await database_1.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('INSERT INTO discount_usage (discount_id, order_id, customer_id, discount_amount) VALUES (?, ?, ?, ?)', [discountId, orderId, customerId, discountAmount]);
            await connection.query('UPDATE discounts SET used_count = used_count + 1, updated_at = NOW() WHERE id = ?', [discountId]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error recording discount usage:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async getActiveDiscounts() {
        try {
            const now = new Date();
            const [rows] = await database_1.db.query(`SELECT * FROM discounts 
        WHERE is_active = TRUE 
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
        ORDER BY created_at DESC`, [now, now]);
            return rows;
        }
        catch (error) {
            console.error('Error getting active discounts:', error);
            throw error;
        }
    }
    async getDiscountUsageStats(discountId) {
        try {
            const [rows] = await database_1.db.query(`SELECT 
          COUNT(*) as total_usage,
          COALESCE(SUM(discount_amount), 0) as total_discount_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM discount_usage
        WHERE discount_id = ?`, [discountId]);
            return {
                totalUsage: rows[0]?.total_usage || 0,
                totalDiscountAmount: parseFloat(rows[0]?.total_discount_amount?.toString() || '0'),
                uniqueCustomers: rows[0]?.unique_customers || 0
            };
        }
        catch (error) {
            console.error('Error getting discount usage stats:', error);
            return {
                totalUsage: 0,
                totalDiscountAmount: 0,
                uniqueCustomers: 0
            };
        }
    }
}
exports.DiscountService = DiscountService;
exports.default = DiscountService.getInstance();
//# sourceMappingURL=discountService.js.map