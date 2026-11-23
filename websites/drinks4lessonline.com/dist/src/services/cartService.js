"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
const database_1 = require("../config/database");
class CartService {
    constructor() { }
    static getInstance() {
        if (!CartService.instance) {
            CartService.instance = new CartService();
        }
        return CartService.instance;
    }
    async getOrCreateSessionCart(sessionId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shopping_carts WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
            if (rows.length > 0) {
                const cart = rows[0];
                cart.items = await this.getCartItems(cart.id);
                return cart;
            }
            const [result] = await database_1.db.query('INSERT INTO shopping_carts (session_id) VALUES (?)', [sessionId]);
            const cartId = result.insertId;
            const cart = await this.getCartById(cartId);
            if (!cart) {
                throw new Error('Failed to create cart');
            }
            cart.items = [];
            return cart;
        }
        catch (error) {
            console.error('Error getting or creating session cart:', error);
            throw error;
        }
    }
    async getOrCreateCustomerCart(customerId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shopping_carts WHERE customer_id = ?', [customerId]);
            if (rows.length > 0) {
                const cart = rows[0];
                cart.items = await this.getCartItems(cart.id);
                return cart;
            }
            const [result] = await database_1.db.query('INSERT INTO shopping_carts (customer_id) VALUES (?)', [customerId]);
            const cartId = result.insertId;
            const cart = await this.getCartById(cartId);
            if (!cart) {
                throw new Error('Failed to create cart');
            }
            cart.items = [];
            return cart;
        }
        catch (error) {
            console.error('Error getting or creating customer cart:', error);
            throw error;
        }
    }
    async getCartById(cartId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shopping_carts WHERE id = ?', [cartId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting cart by ID:', error);
            throw error;
        }
    }
    async getCartItems(cartId) {
        try {
            const [rows] = await database_1.db.query(`SELECT 
          ci.*,
          p.name as product_name,
          p.slug as product_slug,
          pv.name as variant_name,
          pv.attributes as variant_attributes,
          (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        LEFT JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.cart_id = ?
        ORDER BY ci.created_at ASC`, [cartId]);
            const items = rows;
            const itemsWithVariants = items.filter(item => item.variant_id && item.variant_attributes);
            if (itemsWithVariants.length > 0) {
                try {
                    const [variantTypes] = await database_1.db.query('SELECT id, name FROM variant_types');
                    const variantTypeMap = new Map();
                    variantTypes.forEach(vt => variantTypeMap.set(vt.name, vt.id));
                    const valuesToFind = new Set();
                    itemsWithVariants.forEach((item) => {
                        let attrs = item.variant_attributes;
                        if (typeof attrs === 'string') {
                            try {
                                attrs = JSON.parse(attrs);
                            }
                            catch (e) {
                                attrs = {};
                            }
                            item.variant_attributes = attrs;
                        }
                        if (attrs) {
                            Object.values(attrs).forEach((val) => valuesToFind.add(String(val)));
                        }
                    });
                    if (valuesToFind.size > 0) {
                        const [valueRows] = await database_1.db.query('SELECT id, value, variant_type_id FROM variant_type_values WHERE value IN (?)', [Array.from(valuesToFind)]);
                        const valueIdMap = new Map();
                        valueRows.forEach(v => {
                            valueIdMap.set(`${v.variant_type_id}:${v.value}`, v.id);
                        });
                        const productIds = itemsWithVariants.map(i => i.product_id);
                        if (productIds.length > 0) {
                            const [imageRows] = await database_1.db.query('SELECT product_id, attribute_value_id, image_url FROM product_images WHERE product_id IN (?) AND attribute_value_id IS NOT NULL', [productIds]);
                            const imageMap = new Map();
                            imageRows.forEach(img => {
                                imageMap.set(`${img.product_id}:${img.attribute_value_id}`, img.image_url);
                            });
                            itemsWithVariants.forEach((item) => {
                                if (item.variant_attributes) {
                                    for (const [attrName, attrValue] of Object.entries(item.variant_attributes)) {
                                        const typeId = variantTypeMap.get(attrName);
                                        if (typeId) {
                                            const valueId = valueIdMap.get(`${typeId}:${attrValue}`);
                                            if (valueId) {
                                                const specificImage = imageMap.get(`${item.product_id}:${valueId}`);
                                                if (specificImage) {
                                                    item.image_url = specificImage;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
                catch (err) {
                    console.error('Error resolving variant images:', err);
                }
            }
            return items;
        }
        catch (error) {
            console.error('Error getting cart items:', error);
            throw error;
        }
    }
    async addItemToCart(cartId, productId, variantId, quantity, price) {
        try {
            const existingItem = await this.findCartItem(cartId, productId, variantId);
            if (existingItem) {
                const newQuantity = existingItem.quantity + quantity;
                await database_1.db.query('UPDATE cart_items SET quantity = ?, price = ?, updated_at = NOW() WHERE id = ?', [newQuantity, price, existingItem.id]);
                return { ...existingItem, quantity: newQuantity, price };
            }
            else {
                const [result] = await database_1.db.query('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price) VALUES (?, ?, ?, ?, ?)', [cartId, productId, variantId, quantity, price]);
                const itemId = result.insertId;
                const [rows] = await database_1.db.query('SELECT * FROM cart_items WHERE id = ?', [itemId]);
                if (rows.length === 0) {
                    throw new Error('Failed to create cart item');
                }
                return rows[0];
            }
        }
        catch (error) {
            console.error('Error adding item to cart:', error);
            throw error;
        }
    }
    async updateCartItemQuantity(cartItemId, quantity) {
        try {
            if (quantity <= 0) {
                await this.removeCartItem(cartItemId);
                return;
            }
            await database_1.db.query('UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?', [quantity, cartItemId]);
        }
        catch (error) {
            console.error('Error updating cart item quantity:', error);
            throw error;
        }
    }
    async removeCartItem(cartItemId) {
        try {
            await database_1.db.query('DELETE FROM cart_items WHERE id = ?', [cartItemId]);
        }
        catch (error) {
            console.error('Error removing cart item:', error);
            throw error;
        }
    }
    async clearCart(cartId) {
        try {
            await database_1.db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
        }
        catch (error) {
            console.error('Error clearing cart:', error);
            throw error;
        }
    }
    async addOrderItemsToCart(cartId, items) {
        for (const item of items) {
            await this.addItemToCart(cartId, item.product_id, item.variant_id, item.quantity, item.unit_price);
        }
    }
    async findCartItem(cartId, productId, variantId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))', [cartId, productId, variantId, variantId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding cart item:', error);
            return null;
        }
    }
    async getCartTotals(cartId) {
        try {
            const [rows] = await database_1.db.query(`SELECT 
          ci.quantity,
          ci.price,
          p.weight as product_weight,
          pv.weight as variant_weight
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        LEFT JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.cart_id = ?`, [cartId]);
            let itemCount = 0;
            let subtotal = 0;
            let totalWeight = 0;
            rows.forEach((row) => {
                const qty = parseInt(row.quantity || '0');
                const price = parseFloat(row.price || '0');
                const weight = parseFloat(row.variant_weight || row.product_weight || '0.5');
                itemCount += qty;
                subtotal += qty * price;
                totalWeight += qty * weight;
            });
            return {
                itemCount,
                subtotal,
                totalWeight
            };
        }
        catch (error) {
            console.error('Error getting cart totals:', error);
            return { itemCount: 0, subtotal: 0, totalWeight: 0 };
        }
    }
    async mergeCarts(sessionCartId, customerId) {
        try {
            const customerCart = await this.getOrCreateCustomerCart(customerId);
            const sessionItems = await this.getCartItems(sessionCartId);
            for (const item of sessionItems) {
                await this.addItemToCart(customerCart.id, item.product_id, item.variant_id || null, item.quantity, item.price);
            }
            await database_1.db.query('DELETE FROM shopping_carts WHERE id = ?', [sessionCartId]);
            customerCart.items = await this.getCartItems(customerCart.id);
            return customerCart;
        }
        catch (error) {
            console.error('Error merging carts:', error);
            throw error;
        }
    }
    async deleteOldSessionCarts(daysOld = 30) {
        const BATCH_SIZE = 500;
        let total = 0;
        try {
            let affected;
            do {
                const [result] = await database_1.db.query(`DELETE FROM shopping_carts 
          WHERE customer_id IS NULL 
          AND session_id IS NOT NULL 
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          LIMIT ?`, [daysOld, BATCH_SIZE]);
                affected = result.affectedRows || 0;
                total += affected;
                if (affected > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } while (affected === BATCH_SIZE);
            return total;
        }
        catch (error) {
            console.error('Error deleting old session carts:', error);
            return total;
        }
    }
    async deleteOldCustomerCarts(daysOld = 365) {
        const BATCH_SIZE = 500;
        let total = 0;
        try {
            let affected;
            do {
                const [result] = await database_1.db.query(`DELETE FROM shopping_carts 
          WHERE customer_id IS NOT NULL 
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          LIMIT ?`, [daysOld, BATCH_SIZE]);
                affected = result.affectedRows || 0;
                total += affected;
                if (affected > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } while (affected === BATCH_SIZE);
            return total;
        }
        catch (error) {
            console.error('Error deleting old customer carts:', error);
            return total;
        }
    }
    async setCartDiscount(cartId, code) {
        try {
            await database_1.db.query('UPDATE shopping_carts SET discount_code = ?, updated_at = NOW() WHERE id = ?', [code, cartId]);
        }
        catch (error) {
            console.error('Error setting cart discount:', error);
            throw error;
        }
    }
}
exports.CartService = CartService;
exports.default = CartService.getInstance();
//# sourceMappingURL=cartService.js.map