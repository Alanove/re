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
exports.middlewareService = exports.MiddlewareService = void 0;
const pagesService_1 = __importDefault(require("./pagesService"));
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const viewHelpers_1 = require("../utils/viewHelpers");
const env_config_1 = require("../config/env.config");
const turnstile_1 = require("../utils/turnstile");
class MiddlewareService {
    constructor() {
        this.categoryCache = { data: null, expires: 0 };
        this.featuredCache = { data: null, expires: 0 };
        this.CACHE_TTL_MS = 60000;
        this.siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
    }
    static getInstance() {
        if (!MiddlewareService.instance) {
            MiddlewareService.instance = new MiddlewareService();
        }
        return MiddlewareService.instance;
    }
    configureGeneralMiddleware(app) {
        app.use(async (req, res, next) => {
            try {
                await pagesService_1.default.initialize();
                const pageKey = pagesService_1.default.getPageKeyFromPath(req.path);
                const seoData = pagesService_1.default.getSeoData(pageKey, {
                    pageUrl: `${pagesService_1.default.getSiteData().domain}${req.path}`
                });
                res.locals.isHomePage = req.path === '/';
                res.locals.assetVersion = env_config_1.envConfig.assetVersion;
                res.locals.isProduction = env_config_1.envConfig.nodeEnv === 'production';
                res.locals.turnstileSiteKey = (0, turnstile_1.getTurnstileSiteKey)();
                res.locals.items = pagesService_1.default.getMenuItems();
                res.locals.menus = {
                    main: pagesService_1.default.getMenu('Main Menu'),
                    footer: pagesService_1.default.getMenu('Footer Menu'),
                    account: pagesService_1.default.getMenu('Account Menu')
                };
                res.locals.selected = pageKey;
                res.locals.siteData = pagesService_1.default.getSiteData();
                try {
                    res.locals.siteSettings = await this.siteSettingsService.getAllSettings();
                    res.locals.siteImage = res.locals.siteSettings.siteImage || '/MultiShop/img/product-1.jpg';
                }
                catch (error) {
                    console.error('Error loading site settings:', error);
                    res.locals.siteSettings = {};
                    res.locals.siteImage = '/MultiShop/img/product-1.jpg';
                }
                try {
                    const { EcommerceSettingsService } = await Promise.resolve().then(() => __importStar(require('../../admin/services/ecommerceSettingsService')));
                    const s = await EcommerceSettingsService.getInstance().getSettings();
                    res.locals.ecommerceSettings = s || {};
                }
                catch (error) {
                    console.error('Error loading e-commerce settings:', error);
                    res.locals.ecommerceSettings = {};
                }
                try {
                    if (Date.now() >= this.categoryCache.expires) {
                        const categoryService = (await Promise.resolve().then(() => __importStar(require('./categoryService')))).default;
                        const allCategories = await categoryService.getAllCategories();
                        this.categoryCache = {
                            data: allCategories.filter((c) => c.parent_id === null && c.is_active),
                            expires: Date.now() + this.CACHE_TTL_MS,
                        };
                    }
                    res.locals.categories = this.categoryCache.data ?? [];
                }
                catch (error) {
                    console.error('Error loading categories:', error);
                    res.locals.categories = [];
                }
                try {
                    if (Date.now() >= this.featuredCache.expires) {
                        const productService = (await Promise.resolve().then(() => __importStar(require('./productService')))).default;
                        const featuredResult = await productService.getProducts({
                            is_active: true,
                            status: 'published',
                            is_featured: true,
                            page: 1,
                            limit: 10,
                        });
                        const pool = featuredResult?.products ?? [];
                        if (pool.length > 0) {
                            await productService.attachColorOptionsForListing(pool);
                        }
                        this.featuredCache = {
                            data: pool,
                            expires: Date.now() + this.CACHE_TTL_MS,
                        };
                    }
                    const pool = this.featuredCache.data ?? [];
                    if (pool.length > 0) {
                        const randomIndex = Math.floor(Math.random() * pool.length);
                        res.locals.randomFeaturedProduct = pool[randomIndex];
                    }
                    else {
                        res.locals.randomFeaturedProduct = null;
                    }
                }
                catch (error) {
                    console.error('Error loading featured product for menu:', error);
                    res.locals.randomFeaturedProduct = null;
                }
                res.locals.pageTitle = seoData.pageTitle;
                res.locals.pageDescription = seoData.pageDescription;
                res.locals.pageKeywords = seoData.pageKeywords;
                res.locals.pageUrl = seoData.pageUrl;
                res.locals.pageImage = seoData.pageImage;
                res.locals.pageType = seoData.pageType;
                res.locals.pageRobots = seoData.pageRobots;
                res.locals.formatTrademarks = viewHelpers_1.formatTrademarks;
                res.locals.formatMoneyAmount = viewHelpers_1.formatMoneyAmount;
                res.locals.categoryListingImageUrl = viewHelpers_1.categoryListingImageUrl;
                if (req.session && req.session.user) {
                    res.locals.user = req.session.user;
                }
                else {
                    res.locals.user = null;
                }
                try {
                    const cartService = (await Promise.resolve().then(() => __importStar(require('./cartService')))).default;
                    const dbInstance = (await Promise.resolve().then(() => __importStar(require('../config/database')))).default;
                    const userId = req.session && req.session.user ? req.session.user.id : null;
                    const sessionId = req.sessionID;
                    if (userId) {
                        const cart = await cartService.getOrCreateCustomerCart(userId);
                        const cartItems = await cartService.getCartItems(cart.id);
                        res.locals.cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                    }
                    else {
                        const [cartRows] = await dbInstance.query('SELECT id FROM shopping_carts WHERE session_id = ? LIMIT 1', [sessionId]);
                        if (cartRows.length > 0) {
                            const cartItems = await cartService.getCartItems(cartRows[0].id);
                            res.locals.cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                        }
                        else {
                            res.locals.cartCount = 0;
                        }
                    }
                }
                catch (error) {
                    console.error('Error loading cart count:', error);
                    res.locals.cartCount = 0;
                }
                try {
                    const db = (await Promise.resolve().then(() => __importStar(require('../config/database')))).default;
                    const userId = req.session && req.session.user ? req.session.user.id : null;
                    const sessionId = req.sessionID;
                    let wishlistCount = 0;
                    if (userId) {
                        const [rows] = await db.query('SELECT COUNT(*) as count FROM wishlists WHERE customer_id = ?', [userId]);
                        wishlistCount = rows && rows.length > 0 && rows[0].count ? rows[0].count : 0;
                    }
                    else if (sessionId) {
                        const [rows] = await db.query('SELECT COUNT(*) as count FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
                        wishlistCount = rows && rows.length > 0 && rows[0].count ? rows[0].count : 0;
                    }
                    res.locals.wishlistCount = wishlistCount;
                }
                catch (error) {
                    console.error('Error loading wishlist count:', error);
                    res.locals.wishlistCount = 0;
                }
                let bodyClass = req.path === '/' ? 'home' : req.path.slice(1).replace(/\//g, '-');
                if (req.path.startsWith('/projects')) {
                    bodyClass = 'projects';
                }
                if (req.path !== '/' && !req.path.startsWith('/admin') && !req.path.startsWith('/projects') && !req.path.startsWith('/novosti')) {
                    bodyClass += ' inner-page';
                }
                res.locals.bodyClass = bodyClass;
                next();
            }
            catch (error) {
                console.error('Error in middleware:', error);
                next();
            }
        });
    }
}
exports.MiddlewareService = MiddlewareService;
exports.middlewareService = MiddlewareService.getInstance();
exports.default = exports.middlewareService;
//# sourceMappingURL=middlewareService.js.map