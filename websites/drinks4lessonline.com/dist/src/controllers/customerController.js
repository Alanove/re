"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
const usersService_1 = require("../../admin/services/usersService");
const orderService_1 = __importDefault(require("../services/orderService"));
const cartService_1 = __importDefault(require("../services/cartService"));
const database_1 = require("../config/database");
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const orderShipmentService_1 = require("../../admin/services/orderShipmentService");
const i18nService_1 = require("../../admin/services/i18nService");
const emailService_1 = __importDefault(require("../services/emailService"));
const crypto = __importStar(require("crypto"));
const encryptionService_1 = __importDefault(require("../services/encryptionService"));
const env_config_1 = require("../config/env.config");
const turnstile_1 = require("../utils/turnstile");
const data_paths_1 = require("../constants/data-paths");
const fs = __importStar(require("fs"));
const aramex_1 = require("../aramex");
const shippingService_1 = __importDefault(require("../services/shippingService"));
const shipmentService = orderShipmentService_1.OrderShipmentService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const authTurnstileSiteKey = (0, turnstile_1.getTurnstileSiteKey)();
class CustomerController {
    static async account(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.redirect('/customer/login');
                return;
            }
            const user = await usersService_1.usersService.getUserById(customerId);
            if (!user) {
                res.redirect('/customer/login');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const [addresses] = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? AND is_default = 1 LIMIT 1', [customerId]);
            let defaultAddress = null;
            if (addresses && addresses.length > 0) {
                const addr = addresses[0];
                if (addr.content_encrypted && addr.iv) {
                    try {
                        const decryptedData = encryptionService_1.default.decrypt(addr.content_encrypted, addr.iv);
                        if (decryptedData) {
                            defaultAddress = { ...addr, ...decryptedData };
                        }
                    }
                    catch (e) {
                        console.error('Failed to decrypt default address:', e);
                    }
                }
            }
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.account') : 'My Account';
            res.render('customer/account', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.account') : 'My Account',
                siteTitle,
                t,
                user,
                activePage: 'account',
                recentOrders: await orderService_1.default.getCustomerOrders(customerId, 2),
                defaultAddress
            });
        }
        catch (error) {
            console.error('Error rendering account page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async ordersPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.redirect('/customer/login');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const orders = await orderService_1.default.getCustomerOrders(customerId);
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.orders') : 'My Orders';
            res.render('customer/orders', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.orders') : 'My Orders',
                siteTitle,
                t,
                activePage: 'orders',
                orders
            });
        }
        catch (error) {
            console.error('Error rendering orders page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async orderDetailPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.redirect('/customer/login');
                return;
            }
            const { orderNumber } = req.params;
            const order = await orderService_1.default.getOrderByNumber(orderNumber);
            if (!order || order.customer_id !== customerId) {
                res.status(404).render('404');
                return;
            }
            const orderWithItems = await orderService_1.default.getOrderWithItems(order.id);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const shippingMethodLabel = await shippingService_1.default.getShippingMethodDisplayName(orderWithItems?.shipping_method ?? order.shipping_method);
            res.locals.pageTitle = typeof t !== 'undefined' ? `${t('ecommerce.customer.order')} #${order.order_number}` : `Order #${order.order_number}`;
            const firstPid = orderWithItems?.items?.[0]?.product_id;
            if (firstPid) {
                const imgQuery = await database_1.db.query(`SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC, id ASC LIMIT 1`, [firstPid]);
                const imgRows = imgQuery[0];
                const ou = imgRows[0]?.image_url;
                if (ou && String(ou).trim())
                    res.locals.pageImage = String(ou).trim();
            }
            res.render('customer/order-detail', {
                title: typeof t !== 'undefined' ? `${t('ecommerce.customer.order')} #${order.order_number}` : `Order #${order.order_number}`,
                siteTitle,
                t,
                activePage: 'orders',
                order: orderWithItems,
                shippingMethodLabel
            });
        }
        catch (error) {
            console.error('Error rendering order detail page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async addressesPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.redirect('/customer/login');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const [rows] = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC', [customerId]);
            const addresses = rows.map(row => {
                if (row.content_encrypted && row.iv) {
                    try {
                        const decryptedData = encryptionService_1.default.decrypt(row.content_encrypted, row.iv);
                        if (decryptedData) {
                            return { ...row, ...decryptedData };
                        }
                    }
                    catch (e) {
                        console.error('Failed to decrypt address in view controller:', e);
                    }
                }
                return row;
            });
            let countries = [];
            try {
                const countriesPath = (0, data_paths_1.getDataFilePath)('countries.json');
                const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf-8'));
                countries = countriesData.countries || [];
            }
            catch (error) {
                console.error('Error loading countries:', error);
                countries = [
                    { name: 'Lebanon', code: 'LB' },
                    { name: 'United States', code: 'US' },
                    { name: 'United Kingdom', code: 'GB' },
                    { name: 'Canada', code: 'CA' },
                    { name: 'UAE', code: 'AE' }
                ];
            }
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.addresses') : 'My Addresses';
            res.render('customer/addresses', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.addresses') : 'My Addresses',
                siteTitle,
                t,
                activePage: 'addresses',
                addresses,
                returnTo: req.query.returnTo,
                countries
            });
        }
        catch (error) {
            console.error('Error rendering addresses page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async wishlistPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            let query = `SELECT w.*, p.name as product_name, p.slug as product_slug, p.price,
         (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url,
         EXists(SELECT 1 FROM product_variants WHERE product_id = p.id AND is_active = TRUE) as has_variants
         FROM wishlists w
         LEFT JOIN products p ON w.product_id = p.id
         WHERE `;
            let params = [];
            if (customerId) {
                query += 'w.customer_id = ?';
                params.push(customerId);
            }
            else {
                query += 'w.session_id = ? AND w.customer_id IS NULL';
                params.push(sessionId);
            }
            query += ' ORDER BY w.created_at DESC';
            const [wishlist] = await database_1.db.query(query, params);
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.wishlist') : 'My Wishlist';
            const wlOg = wishlist?.find((row) => row.image_url && String(row.image_url).trim())?.image_url;
            if (wlOg)
                res.locals.pageImage = String(wlOg).trim();
            res.render('customer/wishlist', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.wishlist') : 'My Wishlist',
                siteTitle,
                t,
                activePage: 'wishlist',
                wishlist: wishlist || []
            });
        }
        catch (error) {
            console.error('Error rendering wishlist page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async loginPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (customerId) {
                res.redirect('/customer/account');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const returnTo = req.query.returnTo;
            const error = typeof req.query.error === 'string' ? req.query.error : undefined;
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Customer Login';
            res.render('customer/login', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Customer Login',
                siteTitle,
                t,
                returnTo,
                error,
                turnstileSiteKey: authTurnstileSiteKey,
                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production'
            });
        }
        catch (error) {
            console.error('Error rendering login page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async registerPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (customerId) {
                res.redirect('/customer/account');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const returnTo = req.query.returnTo;
            const orderNumber = req.query.orderNumber;
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.register') : 'Customer Registration';
            res.render('customer/register', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.register') : 'Customer Registration',
                siteTitle,
                t,
                returnTo,
                orderNumber: typeof orderNumber === 'string' ? orderNumber : undefined,
                turnstileSiteKey: authTurnstileSiteKey,
                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production'
            });
        }
        catch (error) {
            console.error('Error rendering register page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async register(req, res) {
        try {
            const { email, password, confirmPassword, name, phone, cf_turnstile_response, orderNumber: orderNumberFromBody } = req.body;
            if (env_config_1.envConfig.turnstileSecretKey && !cf_turnstile_response) {
                res.status(400).json({ error: 'Please complete the security verification' });
                return;
            }
            if (env_config_1.envConfig.turnstileSecretKey && cf_turnstile_response) {
                const valid = await (0, turnstile_1.verifyTurnstileToken)(cf_turnstile_response, req.ip || req.socket?.remoteAddress);
                if (!valid) {
                    res.status(400).json({ error: 'Security verification failed. Please try again.' });
                    return;
                }
            }
            const trimmedName = typeof name === 'string' ? name.trim() : '';
            const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
            if (!trimmedName) {
                res.status(400).json({ error: 'Name is required' });
                return;
            }
            if (!trimmedPhone) {
                res.status(400).json({ error: 'Phone is required' });
                return;
            }
            if (password !== confirmPassword) {
                res.status(400).json({ error: 'Passwords do not match' });
                return;
            }
            const existingUser = await usersService_1.usersService.getUserByEmail(email);
            if (existingUser) {
                res.status(400).json({ error: 'Email already registered' });
                return;
            }
            const [result] = await database_1.db.query(`INSERT INTO users (username, email, status, role, created_at)
        VALUES (?, ?, 'Active', 'customer', NOW())`, [email, email]);
            const insertId = result.insertId;
            if (password) {
                await usersService_1.usersService.updateUser(insertId, { password });
            }
            await usersService_1.usersService.updateUser(insertId, { phone: trimmedPhone });
            const user = await usersService_1.usersService.getUserById(insertId);
            if (user) {
                req.session.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };
                const sessionId = req.sessionID;
                const sessionCart = await cartService_1.default.getOrCreateSessionCart(sessionId);
                if (sessionCart.items && sessionCart.items.length > 0) {
                    await cartService_1.default.mergeCarts(sessionCart.id, user.id);
                }
                await orderService_1.default.attachGuestOrdersToCustomer(user.id, (user.email ?? email).trim());
                const orderNumberToAttach = typeof orderNumberFromBody === 'string' ? orderNumberFromBody.trim() : undefined;
                if (orderNumberToAttach) {
                    const orderFromLink = await orderService_1.default.getOrderByNumber(orderNumberToAttach);
                    if (orderFromLink && orderFromLink.customer_id == null) {
                        await orderService_1.default.attachOrderToCustomer(orderFromLink.id, user.id);
                    }
                }
                const [sessionWishlist] = await database_1.db.query('SELECT product_id, variant_id FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
                if (sessionWishlist.length > 0) {
                    for (const item of sessionWishlist) {
                        await database_1.db.query('INSERT IGNORE INTO wishlists (customer_id, product_id, variant_id) VALUES (?, ?, ?)', [user.id, item.product_id, item.variant_id]);
                    }
                    await database_1.db.query('DELETE FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
                }
                res.json({ success: true, user });
            }
            else {
                res.status(500).json({ error: 'Failed to create user' });
            }
        }
        catch (error) {
            console.error('Error registering customer:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
    static async forgotPasswordPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (customerId) {
                res.redirect('/customer/account');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.forgotPassword') : 'Forgot Password';
            res.render('customer/forgot-password', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.forgotPassword') : 'Forgot Password',
                siteTitle,
                t,
                turnstileSiteKey: authTurnstileSiteKey
            });
        }
        catch (error) {
            console.error('Error rendering forgot password page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async forgotPassword(req, res) {
        try {
            const { email, cf_turnstile_response } = req.body;
            if (env_config_1.envConfig.turnstileSecretKey && !cf_turnstile_response) {
                res.status(400).json({ error: 'Please complete the security verification' });
                return;
            }
            if (env_config_1.envConfig.turnstileSecretKey && cf_turnstile_response) {
                const valid = await (0, turnstile_1.verifyTurnstileToken)(cf_turnstile_response, req.ip || req.socket?.remoteAddress);
                if (!valid) {
                    res.status(400).json({ error: 'Security verification failed. Please try again.' });
                    return;
                }
            }
            if (!email) {
                res.status(400).json({ error: 'Email is required' });
                return;
            }
            const user = await usersService_1.usersService.getUserByEmail(email);
            if (!user) {
                if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                    console.log(`Password reset requested for non-existent email: ${email}`);
                res.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions.' });
                return;
            }
            const token = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 3600000);
            await database_1.db.query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', [token, expires, user.id]);
            const resetUrl = `${req.protocol}://${req.get('host')}/customer/reset-password/${token}`;
            await emailService_1.default.sendPasswordReset(email, token, resetUrl);
            res.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions.' });
        }
        catch (error) {
            console.error('Error processing forgot password:', error);
            res.status(500).json({ error: 'Failed to process request' });
        }
    }
    static async resetPasswordPage(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (customerId) {
                res.redirect('/customer/account');
                return;
            }
            const { token } = req.params;
            const [users] = await database_1.db.query('SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()', [token]);
            if (users.length === 0) {
                const siteTitle = await siteSettingsService.getSiteTitle();
                const t = await i18nService_1.i18nService.getTranslations(req);
                res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Login';
                res.render('customer/login', {
                    title: typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Login',
                    siteTitle,
                    t,
                    turnstileSiteKey: authTurnstileSiteKey,
                    isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                    error: 'Password reset link is invalid or has expired.'
                });
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.locals.pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.resetPassword') : 'Reset Password';
            res.render('customer/reset-password', {
                title: typeof t !== 'undefined' ? t('ecommerce.customer.resetPassword') : 'Reset Password',
                siteTitle,
                t,
                token
            });
        }
        catch (error) {
            console.error('Error rendering reset password page:', error);
            res.status(500).render('error', { error });
        }
    }
    static async resetPassword(req, res) {
        try {
            const { token, password, confirmPassword } = req.body;
            if (!password || !confirmPassword) {
                res.status(400).json({ error: 'Password is required' });
                return;
            }
            if (password !== confirmPassword) {
                res.status(400).json({ error: 'Passwords do not match' });
                return;
            }
            const [rows] = await database_1.db.query('SELECT id, email FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()', [token]);
            if (rows.length === 0) {
                res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
                return;
            }
            const user = rows[0];
            await usersService_1.usersService.updateUser(user.id, { password });
            await database_1.db.query('UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?', [user.id]);
            res.json({ success: true, message: 'Password has been reset successfully. Please login.' });
        }
        catch (error) {
            console.error('Error processing password reset:', error);
            res.status(500).json({ error: 'Failed to reset password' });
        }
    }
    static async login(req, res) {
        try {
            const { email, password, cf_turnstile_response } = req.body;
            if (env_config_1.envConfig.turnstileSecretKey && !cf_turnstile_response) {
                res.status(400).json({ error: 'Please complete the security verification' });
                return;
            }
            if (env_config_1.envConfig.turnstileSecretKey && cf_turnstile_response) {
                const valid = await (0, turnstile_1.verifyTurnstileToken)(cf_turnstile_response, req.ip || req.socket?.remoteAddress);
                if (!valid) {
                    res.status(400).json({ error: 'Security verification failed. Please try again.' });
                    return;
                }
            }
            const user = await usersService_1.usersService.authenticateUser(email, password);
            if (user) {
                req.session.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };
                const sessionId = req.sessionID;
                const sessionCart = await cartService_1.default.getOrCreateSessionCart(sessionId);
                if (sessionCart.items && sessionCart.items.length > 0) {
                    await cartService_1.default.mergeCarts(sessionCart.id, user.id);
                }
                const [sessionWishlist] = await database_1.db.query('SELECT product_id, variant_id FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
                if (sessionWishlist.length > 0) {
                    for (const item of sessionWishlist) {
                        await database_1.db.query('INSERT IGNORE INTO wishlists (customer_id, product_id, variant_id) VALUES (?, ?, ?)', [user.id, item.product_id, item.variant_id]);
                    }
                    await database_1.db.query('DELETE FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
                }
                res.json({ success: true, user });
            }
            else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        }
        catch (error) {
            console.error('Error logging in customer:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
    static async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                res.json({ success: true });
            });
        }
        catch (error) {
            console.error('Error logging out:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
    static async logoutRedirect(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                res.redirect('/');
            });
        }
        catch (error) {
            console.error('Error logging out:', error);
            res.redirect('/');
        }
    }
    static async getProfile(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const user = await usersService_1.usersService.getUserById(customerId);
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({ user });
        }
        catch (error) {
            console.error('Error getting profile:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }
    static async updateProfile(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { name, email, phone } = req.body;
            await usersService_1.usersService.updateUser(customerId, { name, email, phone });
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
    static async getOrders(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const orders = await orderService_1.default.getCustomerOrders(customerId);
            res.json({ orders });
        }
        catch (error) {
            console.error('Error getting orders:', error);
            res.status(500).json({ error: 'Failed to get orders' });
        }
    }
    static async getOrder(req, res) {
        try {
            const customerId = req.session.user?.id;
            const { orderId } = req.params;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const order = await orderService_1.default.getOrderWithItems(parseInt(orderId));
            if (!order || order.customer_id !== customerId) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            res.json({ order });
        }
        catch (error) {
            console.error('Error getting order:', error);
            res.status(500).json({ error: 'Failed to get order' });
        }
    }
    static async trackOrder(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ success: false, error: 'Not authenticated' });
                return;
            }
            const orderId = parseInt(req.params.orderId);
            if (isNaN(orderId)) {
                res.status(400).json({ success: false, error: 'Invalid order' });
                return;
            }
            const order = await orderService_1.default.getOrderWithItems(orderId);
            if (!order || order.customer_id !== customerId) {
                res.status(404).json({ success: false, error: 'Order not found' });
                return;
            }
            let trackingNumber = order.tracking_number ?? null;
            if (!trackingNumber) {
                const shipment = await shipmentService.getShipmentByOrderId(orderId);
                trackingNumber = shipment?.tracking_number ?? null;
            }
            if (!trackingNumber || !String(trackingNumber).trim()) {
                res.status(400).json({ success: false, error: 'No tracking number for this order.' });
                return;
            }
            const result = await (0, aramex_1.trackShipmentsJson)([String(trackingNumber).trim()], false);
            if (result.HasErrors) {
                const notifs = result.Notifications;
                const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => n?.Message).filter(Boolean).join('; ') : 'Tracking unavailable';
                res.json({ success: false, error: msg, trackingResults: result.TrackingResults });
                return;
            }
            res.json({
                success: true,
                trackingNumber: String(trackingNumber).trim(),
                trackingResults: result.TrackingResults
            });
        }
        catch (error) {
            console.error('Error tracking order:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get tracking information'
            });
        }
    }
    static async getAddresses(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const [rows] = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC', [customerId]);
            const addresses = rows.map(row => {
                if (row.content_encrypted && row.iv) {
                    try {
                        const decryptedData = encryptionService_1.default.decrypt(row.content_encrypted, row.iv);
                        if (decryptedData) {
                            return { ...row, ...decryptedData };
                        }
                    }
                    catch (e) {
                        console.error('Failed to decrypt address:', e);
                    }
                }
                return row;
            });
            res.json({ addresses });
        }
        catch (error) {
            console.error('Error getting addresses:', error);
            res.status(500).json({ error: 'Failed to get addresses' });
        }
    }
    static async addAddress(req, res) {
        try {
            const customerId = req.session.user?.id;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { type, first_name, last_name, company, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default } = req.body;
            const piiData = {
                first_name,
                last_name,
                company,
                address_line_1,
                address_line_2,
                phone
            };
            const { content: contentEncrypted, iv } = encryptionService_1.default.encrypt(piiData);
            if (is_default) {
                await database_1.db.query('UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ? AND type = ?', [customerId, type || 'shipping']);
            }
            const [result] = await database_1.db.query(`INSERT INTO customer_addresses (
          customer_id, type, city, state, postal_code, country, is_default, content_encrypted, iv
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                customerId, type || 'shipping', city, state, postal_code, country,
                is_default ? 1 : 0, contentEncrypted, iv
            ]);
            res.json({ success: true, addressId: result.insertId });
        }
        catch (error) {
            console.error('Error adding address:', error);
            res.status(500).json({ error: 'Failed to add address' });
        }
    }
    static async updateAddress(req, res) {
        try {
            const customerId = req.session.user?.id;
            const { addressId } = req.params;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const [rows] = await database_1.db.query('SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?', [addressId, customerId]);
            if (!rows || rows.length === 0) {
                res.status(404).json({ error: 'Address not found' });
                return;
            }
            const { type, first_name, last_name, company, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default } = req.body;
            const piiData = {
                first_name,
                last_name,
                company,
                address_line_1,
                address_line_2,
                phone
            };
            const { content: contentEncrypted, iv } = encryptionService_1.default.encrypt(piiData);
            if (is_default) {
                await database_1.db.query('UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ? AND type = ?', [customerId, type || 'shipping']);
            }
            await database_1.db.query(`UPDATE customer_addresses SET 
          type = ?, city = ?, state = ?, postal_code = ?, country = ?, 
          is_default = ?, content_encrypted = ?, iv = ?, updated_at = NOW()
        WHERE id = ? AND customer_id = ?`, [
                type || 'shipping', city, state, postal_code, country,
                is_default ? 1 : 0, contentEncrypted, iv,
                addressId, customerId
            ]);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating address:', error);
            res.status(500).json({ error: 'Failed to update address' });
        }
    }
    static async deleteAddress(req, res) {
        try {
            const customerId = req.session.user?.id;
            const { addressId } = req.params;
            if (!customerId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            await database_1.db.query('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?', [addressId, customerId]);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting address:', error);
            res.status(500).json({ error: 'Failed to delete address' });
        }
    }
    static async getWishlist(req, res) {
        try {
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            let query = `SELECT w.*, p.name as product_name, p.slug as product_slug, p.price,
         (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
         FROM wishlists w
         LEFT JOIN products p ON w.product_id = p.id
         WHERE `;
            let params = [];
            if (customerId) {
                query += 'w.customer_id = ?';
                params.push(customerId);
            }
            else {
                query += 'w.session_id = ? AND w.customer_id IS NULL';
                params.push(sessionId);
            }
            query += ' ORDER BY w.created_at DESC';
            const [rows] = await database_1.db.query(query, params);
            res.json({ wishlist: rows });
        }
        catch (error) {
            console.error('Error getting wishlist:', error);
            res.status(500).json({ error: 'Failed to get wishlist' });
        }
    }
    static async addToWishlist(req, res) {
        try {
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            const { product_id } = req.body;
            if (customerId) {
                await database_1.db.query('INSERT IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)', [customerId, product_id]);
            }
            else {
                await database_1.db.query('INSERT IGNORE INTO wishlists (session_id, product_id) VALUES (?, ?)', [sessionId, product_id]);
            }
            res.json({ success: true, message: 'Product added to wishlist' });
        }
        catch (error) {
            console.error('Error adding to wishlist:', error);
            res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
        }
    }
    static async removeFromWishlist(req, res) {
        try {
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            const { product_id } = req.body;
            if (customerId) {
                await database_1.db.query('DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?', [customerId, product_id]);
            }
            else {
                await database_1.db.query('DELETE FROM wishlists WHERE session_id = ? AND product_id = ?', [sessionId, product_id]);
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error removing from wishlist:', error);
            res.status(500).json({ error: 'Failed to remove from wishlist' });
        }
    }
    static async deleteOldSessionWishlists(daysOld = 30) {
        try {
            const [result] = await database_1.db.query(`DELETE FROM wishlists 
         WHERE customer_id IS NULL 
         AND session_id IS NOT NULL 
         AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [daysOld]);
            return result.affectedRows || 0;
        }
        catch (error) {
            console.error('Error deleting old session wishlists:', error);
            return 0;
        }
    }
}
exports.CustomerController = CustomerController;
//# sourceMappingURL=customerController.js.map