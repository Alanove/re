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
exports.configureRoutes = configureRoutes;
exports.configure404Handler = configure404Handler;
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pagesService_1 = __importDefault(require("../services/pagesService"));
const projectsController_1 = require("../controllers/projectsController");
const homeController_1 = require("../controllers/homeController");
const newsController_1 = require("../controllers/newsController");
const shopController_1 = require("../controllers/shopController");
const facebookProductFeedController_1 = require("../controllers/facebookProductFeedController");
const customerController_1 = require("../controllers/customerController");
const authController_1 = require("../controllers/authController");
const pagesService_2 = require("../../admin/services/pagesService");
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const adminMenuService_1 = require("../../admin/services/adminMenuService");
const usersService_1 = require("../../admin/services/usersService");
const i18nService_1 = require("../../admin/services/i18nService");
const themeService_1 = require("../../admin/services/themeService");
const turnstile_1 = require("../utils/turnstile");
const data_paths_1 = require("../constants/data-paths");
const index_1 = __importDefault(require("../../admin/routes/index"));
const adminPagesService = pagesService_2.PagesService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const sponsorshipUploadDir = path.join(data_paths_1.DATA_PATHS.PUBLIC_DIR, 'uploads', 'sponsorship');
if (!fs.existsSync(sponsorshipUploadDir)) {
    fs.mkdirSync(sponsorshipUploadDir, { recursive: true });
}
const sponsorshipUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, sponsorshipUploadDir),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname) || '';
            const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
            cb(null, `${base}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(pdf|jpe?g|png|gif|webp)$/i.test(file.originalname) ||
            ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype);
        cb(null, !!allowed);
    }
});
function configureRoutes(app) {
    app.get('/', homeController_1.HomeController.index);
    app.get('/events', homeController_1.HomeController.events);
    app.use(async (req, res, next) => {
        try {
            if (req.session && req.session.user) {
                res.locals.user = req.session.user;
            }
            else {
                res.locals.user = null;
            }
            if (!res.locals.t) {
                let currentLanguage = 'en';
                if (req.session && req.session.language) {
                    currentLanguage = req.session.language;
                }
                res.locals.currentLanguage = currentLanguage;
                res.locals.t = (key, params) => {
                    return i18nService_1.i18nService.translate(key, currentLanguage, params);
                };
                res.locals.htmlDir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
                res.locals.htmlLang = currentLanguage;
            }
            if (req.session && req.session.newsletterSuccess) {
                res.locals.newsletterSuccess = req.session.newsletterSuccess;
                req.session.newsletterSuccess = null;
            }
            else {
                res.locals.newsletterSuccess = null;
            }
            if (req.session && req.session.newsletterError) {
                res.locals.newsletterError = req.session.newsletterError;
                req.session.newsletterError = null;
            }
            else {
                res.locals.newsletterError = null;
            }
            res.locals.turnstileSiteKey = (0, turnstile_1.getTurnstileSiteKey)();
            res.locals.productAvailable = (product) => {
                if (!product)
                    return false;
                const tracked = Number(product.track_inventory) === 1;
                if (!tracked)
                    return true;
                return Number(product.stock_quantity) > 0;
            };
            res.locals.noindex = String(process.env.APP_URL || '').includes('liteweb.info');
            next();
        }
        catch (error) {
            console.error('Error in global middleware:', error);
            next();
        }
    });
    app.get('/about', (_req, res) => {
        const pageData = pagesService_1.default.getPageData('about');
        if (pageData) {
            res.locals.pageContent = pageData.content || '';
            res.locals.backgroundImage = pageData.backgroundImage || '';
            res.locals.pageTitle = pageData.title || 'About';
            res.locals.pageDescription = pageData.seo?.pageDescription || '';
        }
        else {
            res.locals.pageTitle = 'About';
        }
        res.render('about');
    });
    app.get('/services', (_req, res) => {
        const pageData = pagesService_1.default.getPageData('services');
        if (pageData) {
            res.locals.pageContent = pageData.content || '';
            res.locals.backgroundImage = pageData.backgroundImage || '';
            res.locals.pageTitle = pageData.title || 'Services';
            res.locals.pageDescription = pageData.seo?.pageDescription || '';
        }
        else {
            res.locals.pageTitle = 'Services';
        }
        res.render('services');
    });
    app.get('/projects', projectsController_1.showProjects);
    app.get('/projects/categories/:category', projectsController_1.showProjects);
    app.get('/projects/countries/:country', projectsController_1.showProjects);
    app.get('/projects/:projectUrl', projectsController_1.showProjectDetail);
    app.get('/novosti', newsController_1.NewsController.list);
    app.get('/novosti/year/:year', newsController_1.NewsController.listByYear);
    app.get('/novosti/month/:date', newsController_1.NewsController.listByMonth);
    app.get('/novosti/day/:date', newsController_1.NewsController.listByDay);
    app.get('/novosti/tag/:tagSlug', newsController_1.NewsController.listByTag);
    app.get('/novosti/:slug', newsController_1.NewsController.article);
    app.get('/video', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'video'
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            res.locals.selected = 'video';
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                pageTitle: 'Видео'
            });
        }
        catch (error) {
            console.error('Error rendering videos listing:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.get('/video/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            const article = await adminPagesService.getPageBySlug(slug);
            if (!article || article.status !== 'published') {
                return res.status(404).render('404');
            }
            const hasVideoTag = article.tags && article.tags.some((tag) => tag.slug === 'video');
            if (!hasVideoTag) {
                return res.status(404).render('404');
            }
            const relatedResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 4,
                status: 'published',
                tag: 'video'
            });
            const relatedArticles = relatedResult.pages.filter((a) => a.id !== article.id).slice(0, 3);
            const pagePhotos = await adminPagesService.getPagePhotos(article.id);
            res.locals.selected = `video-${article.slug}`;
            res.locals.pageTitle = article.title;
            res.locals.pageImage = article.pageImage || '';
            res.locals.pageDescription = article.metaDescription || article.description || '';
            res.render('news/article', {
                article: article,
                relatedArticles: relatedArticles,
                pagePhotos: pagePhotos || []
            });
        }
        catch (error) {
            console.error('Error rendering video article:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.get('/objav', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'objav'
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            res.locals.selected = 'objav';
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                pageTitle: 'Объявления'
            });
        }
        catch (error) {
            console.error('Error rendering announcements listing:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.get('/objav/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            const article = await adminPagesService.getPageBySlug(slug);
            if (!article || article.status !== 'published') {
                return res.status(404).render('404');
            }
            const hasObjavTag = article.tags && article.tags.some((tag) => tag.slug === 'objav');
            if (!hasObjavTag) {
                return res.status(404).render('404');
            }
            const relatedResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 4,
                status: 'published',
                tag: 'objav'
            });
            const relatedArticles = relatedResult.pages.filter((a) => a.id !== article.id).slice(0, 3);
            const pagePhotos = await adminPagesService.getPagePhotos(article.id);
            res.locals.selected = `objav-${article.slug}`;
            res.locals.pageTitle = article.title;
            res.locals.pageImage = article.pageImage || '';
            res.locals.pageDescription = article.metaDescription || article.description || '';
            res.render('news/article', {
                article: article,
                relatedArticles: relatedArticles,
                pagePhotos: pagePhotos || []
            });
        }
        catch (error) {
            console.error('Error rendering announcement article:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.get('/projects-info', (_req, res) => {
        const pageData = pagesService_1.default.getPageData('projects-info');
        if (pageData) {
            res.locals.pageContent = pageData.content || '';
            res.locals.pageTitle = pageData.title || 'Projects Info';
            res.locals.pageDescription = pageData.seo?.pageDescription || '';
        }
        else {
            res.locals.pageTitle = 'Projects Info';
        }
        res.render('projects-info');
    });
    app.get('/about-compound', (_req, res) => {
        const pageData = pagesService_1.default.getPageData('about-compound');
        if (pageData) {
            res.locals.pageContent = pageData.content || '';
            res.locals.pageTitle = pageData.title || 'About Compound';
            res.locals.pageDescription = pageData.seo?.pageDescription || '';
        }
        else {
            res.locals.pageTitle = 'About Compound';
        }
        res.render('about-compound');
    });
    app.get('/contact-us', async (req, res) => {
        try {
            const siteSettings = await siteSettingsService.getAllSettings();
            res.locals.bodyClass = res.locals.bodyClass + ' dark-theme';
            const successMessage = req.session.contactSuccess;
            const errorMessage = req.session.contactError;
            const formData = req.session.contactForm || {};
            req.session.contactSuccess = null;
            req.session.contactError = null;
            req.session.contactForm = null;
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('Rendering contact page with PRG pattern');
            res.locals.layout = 'layout';
            res.locals.pageTitle = 'Contact Us';
            res.locals.pageDescription = siteSettings.siteDescription || '';
            res.render('contact', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: siteSettings,
                successMessage: successMessage,
                errorMessage: errorMessage,
                formData: formData,
                layout: 'layout'
            });
        }
        catch (error) {
            console.error('Error loading contact page:', error);
            res.locals.bodyClass = res.locals.bodyClass + ' dark-theme';
            res.locals.pageTitle = 'Contact Us';
            res.render('contact', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: {}
            });
        }
    });
    app.get('/sponsorship/event', async (req, res) => {
        try {
            const siteSettings = await siteSettingsService.getAllSettings();
            res.locals.bodyClass = res.locals.bodyClass + ' dark-theme';
            const successMessage = req.session.sponsorshipEventSuccess;
            const errorMessage = req.session.sponsorshipEventError;
            const formData = req.session.sponsorshipEventFormData || {};
            req.session.sponsorshipEventSuccess = null;
            req.session.sponsorshipEventError = null;
            req.session.sponsorshipEventFormData = null;
            res.locals.layout = 'layout';
            res.locals.pageTitle = 'Sponsorship Form for Events';
            res.render('sponsorship-event', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: siteSettings,
                successMessage,
                errorMessage,
                formData
            });
        }
        catch (error) {
            console.error('Error loading sponsorship event page:', error);
            res.locals.pageTitle = 'Sponsorship Form for Events';
            res.render('sponsorship-event', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: {},
                formData: {}
            });
        }
    });
    app.get('/sponsorship/athlete', async (req, res) => {
        try {
            const siteSettings = await siteSettingsService.getAllSettings();
            res.locals.bodyClass = res.locals.bodyClass + ' dark-theme';
            const successMessage = req.session.sponsorshipAthleteSuccess;
            const errorMessage = req.session.sponsorshipAthleteError;
            const formData = req.session.sponsorshipAthleteFormData || {};
            req.session.sponsorshipAthleteSuccess = null;
            req.session.sponsorshipAthleteError = null;
            req.session.sponsorshipAthleteFormData = null;
            res.locals.layout = 'layout';
            res.locals.pageTitle = 'Sponsorship Form for Athlete';
            res.render('sponsorship-athlete', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: siteSettings,
                successMessage,
                errorMessage,
                formData
            });
        }
        catch (error) {
            console.error('Error loading sponsorship athlete page:', error);
            res.locals.pageTitle = 'Sponsorship Form for Athlete';
            res.render('sponsorship-athlete', {
                siteData: pagesService_1.default.getSiteData(),
                siteSettings: {},
                formData: {}
            });
        }
    });
    app.post('/contact-us', homeController_1.HomeController.contactSubmit);
    app.post('/sponsorship/event', (req, res, next) => {
        sponsorshipUpload.single('attachment')(req, res, (err) => {
            if (err) {
                req.session.sponsorshipEventError = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 10 MB.' : 'Invalid file. Please upload a PDF or image (JPG, PNG, GIF, WebP).';
                req.session.sponsorshipEventFormData = req.body || {};
                return res.redirect('/sponsorship/event');
            }
            next();
        });
    }, homeController_1.HomeController.sponsorshipSubmit);
    app.post('/sponsorship/athlete', (req, res, next) => {
        sponsorshipUpload.single('attachment')(req, res, (err) => {
            if (err) {
                req.session.sponsorshipAthleteError = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 10 MB.' : 'Invalid file. Please upload a PDF or image (JPG, PNG, GIF, WebP).';
                req.session.sponsorshipAthleteFormData = req.body || {};
                return res.redirect('/sponsorship/athlete');
            }
            next();
        });
    }, homeController_1.HomeController.sponsorshipSubmit);
    app.post('/newsletter', homeController_1.HomeController.newsletterSubmit);
    app.get('/our-categories', shopController_1.ShopController.index);
    app.get('/shop', (req, res, next) => {
        if (Object.keys(req.query).length === 0) {
            res.redirect(301, '/our-categories');
            return;
        }
        next();
    }, shopController_1.ShopController.index);
    app.get('/products', shopController_1.ShopController.index);
    app.get('/on-sale', shopController_1.ShopController.index);
    app.get('/shop/category/:categorySlug', shopController_1.ShopController.index);
    app.get('/shop/brand/:brandSlug', shopController_1.ShopController.index);
    app.get('/shop/category/:categorySlug/brand/:brandSlug', shopController_1.ShopController.index);
    app.get('/shop/product/:slug', shopController_1.ShopController.detail);
    app.get('/product-feed.xml', facebookProductFeedController_1.FacebookProductFeedController.productFeedXml);
    app.get('/shop/:slug', async (req, res, next) => {
        const slug = req.params.slug;
        if (slug && !['category', 'brand'].includes(slug)) {
            const productService = (await Promise.resolve().then(() => __importStar(require('../services/productService')))).default;
            const product = await productService.getProductBySlug(slug);
            if (product) {
                return res.redirect(301, `/shop/product/${slug}`);
            }
        }
        next();
    });
    app.get('/cart', shopController_1.ShopController.cart);
    app.get('/checkout', shopController_1.ShopController.checkout);
    app.get('/checkout/pay', shopController_1.ShopController.checkoutPay);
    app.get('/checkout/complete', shopController_1.ShopController.checkoutComplete);
    app.get('/checkout/cancel', shopController_1.ShopController.checkoutCancel);
    app.get('/order-success', shopController_1.ShopController.orderSuccess);
    app.get('/order-error', shopController_1.ShopController.orderError);
    app.get('/brands', async (req, res) => {
        try {
            const brandService = (await Promise.resolve().then(() => __importStar(require('../services/brandService')))).default;
            const brands = await brandService.getActiveBrands();
            res.locals.pageTitle = 'Brands';
            const brandOg = brands.find((b) => b.logo_url && String(b.logo_url).trim())?.logo_url;
            if (brandOg)
                res.locals.pageImage = String(brandOg).trim();
            res.render('brands', { brands });
        }
        catch (error) {
            console.error('Error rendering brands page:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.post('/api/cart/add', shopController_1.ShopController.addToCart);
    app.post('/api/cart/update', shopController_1.ShopController.updateCartItem);
    app.post('/api/cart/remove', shopController_1.ShopController.removeCartItem);
    app.get('/api/product/:id', shopController_1.ShopController.getProductDetails);
    app.post('/api/checkout', shopController_1.ShopController.processCheckout);
    app.post('/api/discount/validate', shopController_1.ShopController.validateDiscount);
    app.post('/api/reviews/submit', shopController_1.ShopController.submitReview);
    app.get('/api/reviews/product/:product_id', shopController_1.ShopController.getReviews);
    app.get('/api/shipping/rates', shopController_1.ShopController.getShippingRates);
    app.post('/api/shipping/rates', shopController_1.ShopController.getShippingRates);
    app.get('/api/shipping/cities', shopController_1.ShopController.getShippingCities);
    app.get('/api/shipping/states', shopController_1.ShopController.getShippingStates);
    app.get('/api/checkout/payment-methods', shopController_1.ShopController.getCheckoutPaymentMethods);
    app.get('/auth/google', authController_1.AuthController.googleLogin);
    app.get('/auth/google/callback', authController_1.AuthController.googleCallback);
    app.get('/auth/microsoft', authController_1.AuthController.microsoftLogin);
    app.get('/auth/microsoft/callback', authController_1.AuthController.microsoftCallback);
    app.get('/auth/facebook', authController_1.AuthController.facebookLogin);
    app.get('/auth/facebook/callback', authController_1.AuthController.facebookCallback);
    app.get('/customer/account', customerController_1.CustomerController.account);
    app.get('/customer/orders', customerController_1.CustomerController.ordersPage);
    app.get('/customer/orders/:orderNumber', customerController_1.CustomerController.orderDetailPage);
    app.get('/customer/addresses', customerController_1.CustomerController.addressesPage);
    app.get('/customer/wishlist', customerController_1.CustomerController.wishlistPage);
    app.get('/wishlist', customerController_1.CustomerController.wishlistPage);
    app.get('/customer/login', customerController_1.CustomerController.loginPage);
    app.get('/customer/register', customerController_1.CustomerController.registerPage);
    app.get('/customer/forgot-password', customerController_1.CustomerController.forgotPasswordPage);
    app.get('/customer/reset-password/:token', customerController_1.CustomerController.resetPasswordPage);
    app.post('/api/customer/register', customerController_1.CustomerController.register);
    app.post('/api/customer/login', customerController_1.CustomerController.login);
    app.post('/api/customer/forgot-password', customerController_1.CustomerController.forgotPassword);
    app.post('/api/customer/reset-password', customerController_1.CustomerController.resetPassword);
    app.post('/api/customer/logout', customerController_1.CustomerController.logout);
    app.get('/logout', customerController_1.CustomerController.logoutRedirect);
    app.get('/api/customer/profile', customerController_1.CustomerController.getProfile);
    app.post('/api/customer/profile', customerController_1.CustomerController.updateProfile);
    app.get('/api/customer/orders', customerController_1.CustomerController.getOrders);
    app.get('/api/customer/orders/:orderId/track', customerController_1.CustomerController.trackOrder);
    app.get('/api/customer/orders/:orderId', customerController_1.CustomerController.getOrder);
    app.get('/api/customer/addresses', customerController_1.CustomerController.getAddresses);
    app.post('/api/customer/addresses', customerController_1.CustomerController.addAddress);
    app.put('/api/customer/addresses/:addressId', customerController_1.CustomerController.updateAddress);
    app.delete('/api/customer/addresses/:addressId', customerController_1.CustomerController.deleteAddress);
    app.get('/api/customer/wishlist', customerController_1.CustomerController.getWishlist);
    app.post('/api/customer/wishlist/add', customerController_1.CustomerController.addToWishlist);
    app.post('/api/customer/wishlist/remove', customerController_1.CustomerController.removeFromWishlist);
    app.get('/:pageSlug', async (req, res, next) => {
        const pageSlug = req.params.pageSlug;
        const staticFileExtensions = ['.css', '.js', '.json', '.xml', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.txt', '.html', '.htm', '.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ogv', '.mpg', '.mpeg'];
        const isStaticFile = staticFileExtensions.some(ext => pageSlug.toLowerCase().endsWith(ext));
        if (pageSlug.startsWith('admin') || isStaticFile || pageSlug === 'novosti' || pageSlug === 'objav' || pageSlug === 'video' || pageSlug === 'events' || pageSlug === 'on-sale') {
            return next();
        }
        try {
            const page = await adminPagesService.getPageBySlug(pageSlug);
            if (page && page.status === 'published') {
                res.locals.pageContent = page.content || '';
                res.locals.selected = page.slug || pageSlug;
                res.locals.pageTitle = page.title || pageSlug;
                res.locals.pageDescription = page.metaDescription || '';
                res.locals.pageImage = page.pageImage || '';
                const pagePhotos = await adminPagesService.getPagePhotos(page.id);
                res.locals.pagePhotos = pagePhotos || [];
                const isContactPage = pageSlug.toLowerCase().includes('kontakty') ||
                    pageSlug.toLowerCase().includes('contact') ||
                    pageSlug.toLowerCase().includes('адрес') ||
                    pageSlug.toLowerCase().includes('телефон');
                if (isContactPage) {
                    try {
                        const siteSettings = await siteSettingsService.getAllSettings();
                        res.locals.siteSettings = siteSettings || {};
                    }
                    catch (error) {
                        console.error('Error loading site settings for contact page:', error);
                        res.locals.siteSettings = {};
                    }
                }
                res.render('page');
            }
            else {
                if (pageSlug === 'who-we-are') {
                    return res.render('about');
                }
                else if (pageSlug === 'contact') {
                    return res.redirect('/contact-us');
                }
                else if (pageSlug.startsWith('what-we-do') || pageSlug.startsWith('Our-') || pageSlug === 'our-soft-skills' || pageSlug === 'our-it-system') {
                    res.locals.pageContent = `<h1>${pageSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1><p>This page is coming soon.</p>`;
                    res.locals.pageImage = '';
                    return res.render('page');
                }
                next();
            }
        }
        catch (error) {
            console.error('Error loading dynamic page:', error);
            next();
        }
    });
    app.get('/admin', (_req, res) => {
        res.redirect('/admin/login');
    });
    app.use('/admin', async (req, res, next) => {
        try {
            let currentLanguage = 'en';
            if (req.session && req.session.language) {
                const sessionLang = req.session.language;
                if (i18nService_1.i18nService.isSupportedLanguage(sessionLang)) {
                    currentLanguage = sessionLang;
                }
            }
            else if (req.session && req.session.user) {
                const userLang = await usersService_1.usersService.getUserById(req.session.user.id);
                if (userLang && userLang.language && i18nService_1.i18nService.isSupportedLanguage(userLang.language)) {
                    currentLanguage = userLang.language;
                }
            }
            if (req.path === '/login') {
                res.locals.layout = false;
            }
            else {
                res.locals.layout = 'admin-layout';
                if (req.session && req.session.user) {
                    res.locals.user = req.session.user;
                }
                else {
                    res.locals.user = null;
                }
                const adminMenuService = adminMenuService_1.AdminMenuService.getInstance();
                const currentPath = req.baseUrl + req.path;
                let adminMenu = await adminMenuService.getMenuWithCurrent(currentPath, currentLanguage);
                if (req.session && req.session.user) {
                    const user = await usersService_1.usersService.getUserById(req.session.user.id);
                    if (user && user.role) {
                        const filterByRole = (items) => {
                            return items.filter(item => {
                                if (!item.isVisible)
                                    return false;
                                if (item.roles.length === 0 || item.roles.includes(user.role)) {
                                    if (item.children && item.children.length > 0) {
                                        item.children = filterByRole(item.children);
                                    }
                                    return true;
                                }
                                return false;
                            });
                        };
                        adminMenu = filterByRole(adminMenu);
                    }
                }
                const pagesMenuItem = adminMenu.find((item) => item.title === 'Pages' || item.text === 'Pages' || item.url === '/admin/pages');
                if (pagesMenuItem) {
                    try {
                        const isPagesRoute = req.path === '/admin/pages' || req.path.startsWith('/admin/pages/');
                        const currentTag = req.query.tag;
                        if (isPagesRoute) {
                            pagesMenuItem.current = true;
                        }
                        if (pagesMenuItem.children) {
                            pagesMenuItem.children = pagesMenuItem.children.filter((child) => child.title !== 'Tags' && child.text !== 'Tags');
                        }
                        const topTags = await adminPagesService.getTopTags(10);
                        if (!pagesMenuItem.children) {
                            pagesMenuItem.children = [];
                        }
                        topTags.forEach((tag) => {
                            const isActive = isPagesRoute && currentTag === tag.slug;
                            pagesMenuItem.children.push({
                                id: `tag-${tag.id}`,
                                title: tag.name,
                                text: tag.name,
                                url: `/admin/pages?tag=${encodeURIComponent(tag.slug)}`,
                                parentId: pagesMenuItem.id,
                                order: pagesMenuItem.children.length + 1,
                                icon: 'fa fa-tag',
                                roles: [],
                                isVisible: true,
                                current: isActive
                            });
                        });
                        if (isPagesRoute && !currentTag && pagesMenuItem.children.length > 0) {
                            const parentLink = pagesMenuItem.children.find((child) => child.url === pagesMenuItem.url);
                            if (parentLink) {
                                parentLink.current = true;
                            }
                        }
                    }
                    catch (error) {
                        console.error('Error injecting tags into Pages menu:', error);
                    }
                }
                res.locals.adminMenu = adminMenu;
                const themeClasses = await themeService_1.themeService.getThemeClasses();
                res.locals.themeClasses = themeClasses.join(' ');
                res.locals.currentTheme = await themeService_1.themeService.getCurrentTheme();
            }
            res.locals.currentLanguage = currentLanguage;
            res.locals.t = (key, params) => {
                return i18nService_1.i18nService.translate(key, currentLanguage, params);
            };
            res.locals.supportedLanguages = i18nService_1.i18nService.getSupportedLanguages();
            res.locals.getLanguageName = (lang) => {
                return i18nService_1.i18nService.getLanguageName(lang);
            };
            if (currentLanguage === 'ar') {
                res.locals.htmlDir = 'rtl';
                res.locals.htmlLang = 'ar';
            }
            else {
                res.locals.htmlDir = 'ltr';
                res.locals.htmlLang = currentLanguage;
            }
            next();
        }
        catch (error) {
            console.error('Error in admin layout middleware:', error);
            next();
        }
    });
    app.use('/admin', index_1.default);
}
function configure404Handler(app) {
    app.use((req, res) => {
        try {
            const siteData = pagesService_1.default.getSiteData();
            const siteTitle = siteData.name || 'CMS';
            const seoData = pagesService_1.default.getSeoData('404', {
                pageTitle: `Page Not Found - ${siteTitle}`,
                pageDescription: 'The page you are looking for could not be found.',
                pageKeywords: '404, page not found',
                pageUrl: `${siteData.domain}${req.path}`,
                pageImage: siteData.logo,
                pageType: 'website',
                pageRobots: 'noindex, nofollow'
            });
            res.locals.bodyClass = '404';
            res.status(404).render('404', seoData);
        }
        catch (error) {
            console.error('Error in 404 handler:', error);
            res.locals.bodyClass = '404';
            res.status(404).render('404', {
                pageTitle: 'Page Not Found',
                pageDescription: 'The page you are looking for could not be found.',
                pageKeywords: '404, page not found'
            });
        }
    });
}
//# sourceMappingURL=index.js.map