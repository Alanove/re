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
exports.ShopController = void 0;
const productService_1 = __importStar(require("../services/productService"));
const categoryService_1 = __importDefault(require("../services/categoryService"));
const cartService_1 = __importDefault(require("../services/cartService"));
const orderService_1 = __importDefault(require("../services/orderService"));
const discountService_1 = __importDefault(require("../services/discountService"));
const shippingService_1 = __importDefault(require("../services/shippingService"));
const paymentService_1 = __importDefault(require("../services/paymentService"));
const netcommerceService_1 = __importDefault(require("../services/paymentGateways/netcommerceService"));
const reviewService_1 = __importDefault(require("../services/reviewService"));
const productAttributeService_1 = require("../../admin/services/productAttributeService");
const emailService_1 = __importDefault(require("../services/emailService"));
const ecommerceSettingsService_1 = require("../../admin/services/ecommerceSettingsService");
const database_1 = require("../config/database");
const env_config_1 = require("../config/env.config");
const turnstile_1 = require("../utils/turnstile");
const data_paths_1 = require("../constants/data-paths");
const fs = __importStar(require("fs"));
const encryptionService_1 = __importDefault(require("../services/encryptionService"));
const currentUrlProviderService_1 = require("../services/currentUrlProviderService");
const usersService_1 = require("../../admin/services/usersService");
const aramexApiClient_1 = require("../aramex/aramexApiClient");
const variantDisplayService_1 = require("../services/variantDisplayService");
const productOgImage_1 = require("../utils/productOgImage");
const homepageSettingsService_1 = require("../../admin/services/homepageSettingsService");
const facebookCatalogId_1 = require("../utils/facebookCatalogId");
class ShopController {
    static metaCurrency(res) {
        const settings = res.locals.ecommerceSettings;
        return settings?.currency?.trim() || 'USD';
    }
    static async ensureOrderBelongsToUser(req, res, order) {
        const customerId = req.session.user?.id;
        const orderCustomerId = order.customer_id ?? null;
        if (customerId !== undefined && customerId !== null) {
            if (orderCustomerId !== customerId) {
                res.redirect('/shop?error=access_denied');
                return false;
            }
        }
        else {
            if (orderCustomerId !== null) {
                res.redirect('/shop?error=access_denied');
                return false;
            }
        }
        return true;
    }
    static async index(req, res) {
        try {
            const categorySlug = req.params.categorySlug;
            const brandSlug = req.params.brandSlug;
            const { search, min_price, max_price, featured, page = '1', limit = '40', sort_by = 'created_at', sort_order = 'DESC', ...attributeParams } = req.query;
            const categories = await categoryService_1.default.getCategoryTree();
            const productAttributeService = productAttributeService_1.ProductAttributeService.getInstance();
            const allAttributes = await productAttributeService.getAllProductAttributes(false);
            const attributeFilters = {};
            allAttributes.forEach(attr => {
                if (attributeParams[attr.slug]) {
                    attributeFilters[attr.slug] = attributeParams[attr.slug].split(',');
                }
            });
            const hasFilters = !!(categorySlug || brandSlug || search || min_price || max_price || featured || Object.keys(attributeFilters).length > 0);
            const isProductsPage = req.path === '/products';
            const isOnSalePage = req.path === '/on-sale';
            if (!hasFilters && !isProductsPage && !isOnSalePage) {
                res.locals.pageTitle = 'Shop';
                const fp = res.locals.randomFeaturedProduct;
                const ogFeatured = fp ? (0, productOgImage_1.ogImageUrlFromProduct)(fp) : '';
                if (ogFeatured)
                    res.locals.pageImage = ogFeatured;
                res.render('shop', {
                    showCategoriesGrid: true,
                    categories,
                    filters: {}
                });
                return;
            }
            const baseFilters = {
                is_active: true,
                status: 'published',
                sort_by: sort_by,
                sort_order: sort_order,
                page: 1,
                limit: 100000
            };
            let categoryData = null;
            if (categorySlug) {
                categoryData = await categoryService_1.default.getCategoryBySlug(categorySlug);
                if (categoryData)
                    baseFilters.category_id = categoryData.id;
            }
            if (brandSlug) {
                const brandService = (await Promise.resolve().then(() => __importStar(require('../services/brandService')))).default;
                const brandData = await brandService.getBrandBySlug(brandSlug);
                if (brandData)
                    baseFilters.brand_id = brandData.id;
            }
            if (search)
                baseFilters.search = search;
            if (featured === 'true')
                baseFilters.is_featured = true;
            if (isOnSalePage)
                baseFilters.on_sale = true;
            if (Object.keys(attributeFilters).length > 0)
                baseFilters.attributes = attributeFilters;
            const allMatchesResult = await productService_1.default.getProducts(baseFilters);
            let allProducts = allMatchesResult.products;
            let priceRange = { min: 0, max: 0 };
            if (allProducts.length > 0) {
                const prices = allProducts.map(p => Number(p.price));
                priceRange = {
                    min: Math.floor(Math.min(...prices)),
                    max: Math.ceil(Math.max(...prices))
                };
            }
            let filteredProducts = allProducts;
            if (min_price) {
                const min = parseFloat(min_price);
                filteredProducts = filteredProducts.filter(p => Number(p.price) >= min);
            }
            if (max_price) {
                const max = parseFloat(max_price);
                filteredProducts = filteredProducts.filter(p => Number(p.price) <= max);
            }
            const availableFilters = await ShopController.calculateAvailableFilters(baseFilters, filteredProducts);
            if (categoryData && categoryData.parent_id) {
                const parentId = categoryData.parent_id;
                const findCategoryInTree = (cats, id) => {
                    for (const cat of cats) {
                        if (cat.id === id)
                            return cat;
                        if (cat.children && cat.children.length > 0) {
                            const found = findCategoryInTree(cat.children, id);
                            if (found)
                                return found;
                        }
                    }
                    return null;
                };
                const parentCategory = findCategoryInTree(categories, parentId);
                if (parentCategory) {
                    const idx = availableFilters.categories.findIndex((c) => c.id === parentId);
                    if (idx !== -1) {
                        availableFilters.categories[idx] = parentCategory;
                    }
                    else {
                        availableFilters.categories.unshift(parentCategory);
                    }
                }
            }
            if (!availableFilters.categories || availableFilters.categories.length === 0) {
                availableFilters.categories = categories;
            }
            if (!availableFilters.attributes || availableFilters.attributes.length === 0) {
                if (filteredProducts.length === 0 && hasFilters) {
                    availableFilters.attributes = allAttributes;
                }
                else if (!hasFilters) {
                    availableFilters.attributes = allAttributes;
                }
            }
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const total = filteredProducts.length;
            const totalPages = Math.ceil(total / limitNum);
            const offset = (pageNum - 1) * limitNum;
            const productsToRender = filteredProducts.slice(offset, offset + limitNum);
            await productService_1.default.attachColorOptionsForListing(productsToRender);
            if (categoryData) {
                res.locals.pageTitle = categoryData.name;
                res.locals.pageDescription = categoryData.meta_description || '';
            }
            else if (brandSlug) {
                const brandService = (await Promise.resolve().then(() => __importStar(require('../services/brandService')))).default;
                const brandData = await brandService.getBrandBySlug(brandSlug);
                res.locals.pageTitle = brandData?.name || 'Brand';
                res.locals.pageDescription = brandData?.meta_description || '';
            }
            else if (isOnSalePage) {
                const homepageSettings = await homepageSettingsService_1.HomepageSettingsService.getInstance().getSettings();
                res.locals.pageTitle = homepageSettings.saleMetaTitle || homepageSettings.saleTitle || 'Sale';
                res.locals.pageDescription = homepageSettings.saleMetaDescription || homepageSettingsService_1.DEFAULT_SALE_META_DESCRIPTION;
                res.locals.listingTitle = homepageSettings.saleTitle || 'Sale';
            }
            else if (isProductsPage) {
                res.locals.pageTitle = 'All Products';
            }
            else if (search) {
                res.locals.pageTitle = `Search: ${search}`;
            }
            let shopOgImage = (0, productOgImage_1.ogImageUrlFromProductList)(productsToRender);
            if (!shopOgImage && categoryData && String(categoryData.image_url || '').trim()) {
                shopOgImage = String(categoryData.image_url).trim();
            }
            if (!shopOgImage && brandSlug) {
                const brandService = (await Promise.resolve().then(() => __importStar(require('../services/brandService')))).default;
                const bd = await brandService.getBrandBySlug(brandSlug);
                if (bd?.logo_url)
                    shopOgImage = bd.logo_url;
            }
            if (shopOgImage)
                res.locals.pageImage = shopOgImage;
            const categoryTrail = categoryData
                ? await categoryService_1.default.getCategoryBreadcrumbs(categoryData.id)
                : [];
            res.render('shop', {
                showCategoriesGrid: false,
                products: productsToRender,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: total,
                    totalPages: totalPages
                },
                categories: categories,
                filterCategories: (availableFilters.categories && availableFilters.categories.length > 0) ? availableFilters.categories : categories,
                attributeFilters: (availableFilters.attributes && availableFilters.attributes.length > 0) ? availableFilters.attributes : allAttributes,
                currentCategory: categorySlug,
                categoryTrail,
                currentBrand: brandSlug,
                isProductsPage: isProductsPage,
                isOnSalePage: isOnSalePage,
                listingTitle: res.locals.listingTitle || '',
                filters: {
                    search,
                    min_price,
                    max_price,
                    featured,
                    sort_by,
                    sort_order,
                    ...attributeFilters
                },
                priceRange
            });
        }
        catch (error) {
            console.error('Error rendering shop page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async calculateAvailableFilters(currentFilters, products) {
        try {
            if (products.length === 0) {
                return { categories: [], attributes: [] };
            }
            const productIds = products.map(p => p.id);
            const [categoryRows] = await database_1.db.query(`SELECT DISTINCT pc.id, pc.name, pc.slug, pc.parent_id
         FROM product_categories pc
         JOIN product_category_relations pcr ON pc.id = pcr.category_id
         WHERE pcr.product_id IN (?)
         ORDER BY pc.name`, [productIds]);
            const categoryMap = new Map();
            categoryRows.forEach(cat => {
                categoryMap.set(cat.id, { ...cat, children: [] });
            });
            const rootCategories = [];
            categoryRows.forEach(cat => {
                const category = categoryMap.get(cat.id);
                if (cat.parent_id && categoryMap.has(cat.parent_id)) {
                    categoryMap.get(cat.parent_id).children.push(category);
                }
                else {
                    rootCategories.push(category);
                }
            });
            const [attributeRows] = await database_1.db.query(`SELECT DISTINCT 
           vt.id as variant_type_id,
           vt.name as attribute_name,
           vt.slug as attribute_slug,
           vt.display_order as variant_display_order,
           vtv.id as value_id,
           vtv.value as value_name,
           vtv.color_code,
           vtv.image_url,
           vtv.display_order as value_display_order
         FROM product_attributes pa
         JOIN variant_types vt ON pa.variant_type_id = vt.id
         JOIN variant_type_values vtv ON JSON_CONTAINS(pa.selected_values, CAST(? AS JSON))
         WHERE pa.product_id IN (?)
           AND vt.is_active = TRUE
           AND vtv.is_active = TRUE
         ORDER BY vt.display_order, vt.name, vtv.display_order, vtv.value`, [JSON.stringify([0]), productIds]);
            const [productAttrRows] = await database_1.db.query(`SELECT pa.product_id, pa.variant_type_id, pa.selected_values
         FROM product_attributes pa
         WHERE pa.product_id IN (?)`, [productIds]);
            const [allVariantTypes] = await database_1.db.query(`SELECT vt.id, vt.name, vt.slug, vt.display_order
         FROM variant_types vt
         WHERE vt.is_active = TRUE
         ORDER BY vt.display_order, vt.name`);
            const [allVariantValues] = await database_1.db.query(`SELECT vtv.id, vtv.variant_type_id, vtv.value, vtv.color_code, vtv.image_url, vtv.display_order
         FROM variant_type_values vtv
         WHERE vtv.is_active = TRUE
         ORDER BY vtv.display_order, vtv.value`);
            const availableValueIds = new Set();
            productAttrRows.forEach(par => {
                try {
                    const selectedValues = typeof par.selected_values === 'string'
                        ? JSON.parse(par.selected_values)
                        : par.selected_values;
                    if (Array.isArray(selectedValues)) {
                        selectedValues.forEach((valId) => {
                            if (valId != null && (typeof valId === 'number' || typeof valId === 'string')) {
                                availableValueIds.add(Number(valId));
                            }
                        });
                    }
                }
                catch (e) {
                }
            });
            const attributeMap = new Map();
            allVariantTypes.forEach(vt => {
                const attrValues = allVariantValues
                    .filter(vtv => vtv.variant_type_id === vt.id && availableValueIds.has(vtv.id))
                    .map(vtv => ({
                    id: vtv.id,
                    value: vtv.value,
                    color_code: vtv.color_code,
                    image_url: vtv.image_url,
                    display_order: vtv.display_order
                }))
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                if (attrValues.length > 0) {
                    const hasAttribute = productAttrRows.some(par => par.variant_type_id === vt.id);
                    if (hasAttribute) {
                        attributeMap.set(vt.id, {
                            id: vt.id,
                            name: vt.name,
                            slug: vt.slug,
                            display_order: vt.display_order,
                            values: attrValues
                        });
                    }
                }
            });
            const availableAttributes = Array.from(attributeMap.values())
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            availableAttributes.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            return {
                categories: rootCategories,
                attributes: availableAttributes
            };
        }
        catch (error) {
            console.error('Error calculating available filters:', error);
            return { categories: [], attributes: [] };
        }
    }
    static async detail(req, res) {
        try {
            const { slug } = req.params;
            const product = await productService_1.default.getProductBySlug(slug);
            if (!product || !product.is_active || product.status !== 'published') {
                res.status(404).render('404');
                return;
            }
            productService_1.default.incrementViewCount(product.id).catch(() => { });
            const productDetails = await productService_1.default.getProductWithDetails(product.id);
            if (!productDetails) {
                res.status(404).render('404');
                return;
            }
            const relatedProducts = await productService_1.default.getRelatedProducts(product.id, product.category_id, 4);
            await productService_1.default.attachColorOptionsForListing(relatedProducts);
            (0, productService_1.attachMultiPriceListingFieldsForProduct)(productDetails, productDetails.variants || []);
            const reviews = await reviewService_1.default.getProductReviews(product.id, {
                approvedOnly: true,
                limit: 10
            });
            const productAttributeService = productAttributeService_1.ProductAttributeService.getInstance();
            const productAttributes = await productAttributeService.getProductAttributes(product.id);
            const variantDisplay = (0, variantDisplayService_1.buildVariantDisplayModel)(productDetails, productDetails.variants || [], productAttributes);
            const productTitle = productDetails.name || product.name || slug;
            res.locals.pageTitle = productTitle;
            res.locals.pageDescription = product.meta_description || productDetails.short_description || '';
            const ogProductImage = (0, productOgImage_1.ogImageUrlFromProduct)(productDetails);
            if (ogProductImage)
                res.locals.pageImage = ogProductImage;
            const variants = productDetails.variants || [];
            const defaultVariant = variants.length > 0 ? variants[0] : null;
            const metaViewContent = {
                contentId: (0, facebookCatalogId_1.resolveFacebookCatalogContentId)({
                    productId: productDetails.id,
                    variantId: defaultVariant?.id ?? null,
                    productSku: productDetails.sku,
                    variantSku: defaultVariant?.sku
                }),
                value: defaultVariant?.price != null
                    ? parseFloat(String(defaultVariant.price))
                    : parseFloat(String(productDetails.price)) || 0,
                currency: ShopController.metaCurrency(res)
            };
            res.render('detail', {
                product: productDetails,
                relatedProducts,
                metaViewContent,
                reviews,
                productAttributes,
                variantDisplay,
                currentFullUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
                turnstileSiteKey: (0, turnstile_1.getTurnstileSiteKey)(),
                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production'
            });
        }
        catch (error) {
            console.error('Error rendering product detail page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async cart(req, res) {
        try {
            const sessionId = req.sessionID;
            const customerId = req.session.user?.id;
            let cart;
            if (customerId) {
                cart = await cartService_1.default.getOrCreateCustomerCart(customerId);
            }
            else {
                cart = await cartService_1.default.getOrCreateSessionCart(sessionId);
            }
            const cartTotals = await cartService_1.default.getCartTotals(cart.id);
            let discountAmount = 0;
            let appliedDiscount = null;
            if (cart.discount_code) {
                const cartItems = await cartService_1.default.getCartItems(cart.id);
                const productIds = cartItems.map(item => item.product_id);
                const validation = await discountService_1.default.validateDiscountCode(cart.discount_code, cartTotals.subtotal, customerId || null, productIds);
                if (validation.valid && validation.discountAmount) {
                    discountAmount = validation.discountAmount;
                    appliedDiscount = validation.discount;
                }
                else {
                }
            }
            const totals = {
                ...cartTotals,
                shipping: 0,
                discount: discountAmount,
                total: Math.max(0, cartTotals.subtotal - discountAmount)
            };
            res.locals.pageTitle = 'Cart';
            const cartOg = cart.items?.find((i) => i.image_url && String(i.image_url).trim())?.image_url;
            if (cartOg)
                res.locals.pageImage = String(cartOg).trim();
            res.render('cart', {
                cart,
                totals,
                appliedDiscountCode: cart.discount_code,
                cancelled: req.query.cancelled === '1',
                metaCheckoutFailed: req.query.error === 'meta_checkout'
            });
        }
        catch (error) {
            console.error('Error rendering cart page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async addToCart(req, res) {
        try {
            const { product_id, variant_id, quantity = 1 } = req.body;
            if (!product_id) {
                res.status(400).json({ success: false, error: 'Product ID is required' });
                return;
            }
            const sessionId = req.sessionID;
            const customerId = req.session.user?.id;
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('Add to cart request:', { product_id, variant_id, quantity, sessionId, customerId });
            const product = await productService_1.default.getProductById(parseInt(product_id));
            if (!product) {
                res.status(404).json({ success: false, error: 'Product not found' });
                return;
            }
            const price = await productService_1.default.getProductPrice(product.id, variant_id ? parseInt(variant_id) : undefined);
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('Product price:', price);
            const inStock = await productService_1.default.isInStock(product.id, variant_id ? parseInt(variant_id) : undefined, parseInt(quantity));
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('In stock:', inStock);
            if (!inStock) {
                res.status(400).json({ success: false, error: 'Product is out of stock' });
                return;
            }
            let cart;
            if (customerId) {
                cart = await cartService_1.default.getOrCreateCustomerCart(customerId);
            }
            else {
                cart = await cartService_1.default.getOrCreateSessionCart(sessionId);
            }
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('Cart ID:', cart.id);
            await cartService_1.default.addItemToCart(cart.id, product.id, variant_id ? parseInt(variant_id) : null, parseInt(quantity), price);
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                console.log('Item added to cart successfully');
            const totals = await cartService_1.default.getCartTotals(cart.id);
            const contentId = await (0, facebookCatalogId_1.resolveFacebookCatalogContentIdFromDb)(product.id, variant_id ? parseInt(variant_id) : null);
            res.json({
                success: true,
                message: 'Item added to cart',
                cartCount: totals.itemCount,
                meta: {
                    contentId,
                    value: price,
                    currency: ShopController.metaCurrency(res),
                    quantity: parseInt(String(quantity), 10) || 1
                }
            });
        }
        catch (error) {
            console.error('Error adding to cart:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to add item to cart' });
        }
    }
    static async updateCartItem(req, res) {
        try {
            const { item_id, quantity } = req.body;
            await cartService_1.default.updateCartItemQuantity(parseInt(item_id), parseInt(quantity));
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating cart item:', error);
            res.status(500).json({ error: 'Failed to update cart item' });
        }
    }
    static async removeCartItem(req, res) {
        try {
            const { item_id } = req.body;
            await cartService_1.default.removeCartItem(parseInt(item_id));
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error removing cart item:', error);
            res.status(500).json({ error: 'Failed to remove cart item' });
        }
    }
    static async populateCartFromMetaShopCheckout(cartId, productsParam, couponParam) {
        const warnings = [];
        const lines = (0, facebookCatalogId_1.parseMetaShopProductsParam)(productsParam);
        await cartService_1.default.clearCart(cartId);
        await cartService_1.default.setCartDiscount(cartId, null);
        if (lines.length === 0) {
            warnings.push('No valid products in checkout link.');
            return warnings;
        }
        let addedCount = 0;
        for (const line of lines) {
            const resolved = await (0, facebookCatalogId_1.resolveProductVariantFromCatalogContentId)(line.catalogContentId);
            if (!resolved) {
                warnings.push(`Product "${line.catalogContentId}" was not found.`);
                continue;
            }
            const product = await productService_1.default.getProductById(resolved.productId);
            if (!product || !product.is_active || product.status !== 'published') {
                warnings.push(`Product "${line.catalogContentId}" is not available.`);
                continue;
            }
            const variantId = resolved.variantId ?? undefined;
            const inStock = await productService_1.default.isInStock(resolved.productId, variantId, line.quantity);
            if (!inStock) {
                warnings.push(`Product "${line.catalogContentId}" is out of stock.`);
                continue;
            }
            const price = await productService_1.default.getProductPrice(resolved.productId, variantId);
            await cartService_1.default.addItemToCart(cartId, resolved.productId, resolved.variantId, line.quantity, price);
            addedCount++;
        }
        if (addedCount === 0 && warnings.length === 0) {
            warnings.push('Could not add products from checkout link.');
        }
        const coupon = typeof couponParam === 'string' ? couponParam.trim() : '';
        if (coupon) {
            await cartService_1.default.setCartDiscount(cartId, coupon);
        }
        if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
            console.log('[Meta Shop Checkout]', {
                lines: lines.length,
                addedCount,
                coupon: coupon || null,
                warnings
            });
        }
        return warnings;
    }
    static async checkout(req, res) {
        try {
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
            if (debugOn)
                console.log(`[Checkout Debug] SessionID: ${sessionId}, CustomerID: ${customerId ?? 'guest'}`);
            const cart = customerId
                ? await cartService_1.default.getOrCreateCustomerCart(customerId)
                : await cartService_1.default.getOrCreateSessionCart(sessionId);
            if (debugOn)
                console.log(`[Checkout Debug] Retrieved customer cart: ${cart.id}`);
            const productsParam = typeof req.query.products === 'string' ? req.query.products.trim() : '';
            let metaShopWarnings = [];
            if (productsParam) {
                const couponParam = typeof req.query.coupon === 'string' ? req.query.coupon : undefined;
                metaShopWarnings = await ShopController.populateCartFromMetaShopCheckout(cart.id, productsParam, couponParam);
                cart.discount_code =
                    typeof req.query.coupon === 'string' && req.query.coupon.trim()
                        ? req.query.coupon.trim()
                        : null;
            }
            const cartTotals = await cartService_1.default.getCartTotals(cart.id);
            if (debugOn)
                console.log(`[Checkout Debug] Cart totals:`, cartTotals);
            if (cartTotals.itemCount === 0) {
                if (debugOn)
                    console.log(`[Checkout Debug] Cart empty, redirecting to cart`);
                const err = productsParam && metaShopWarnings.length > 0
                    ? 'meta_checkout'
                    : undefined;
                res.redirect(err ? `/cart?error=${err}` : '/cart');
                return;
            }
            let discountAmount = 0;
            if (cart.discount_code) {
                const cartItems = await cartService_1.default.getCartItems(cart.id);
                const productIds = cartItems.map(item => item.product_id);
                const validation = await discountService_1.default.validateDiscountCode(cart.discount_code, cartTotals.subtotal, customerId || null, productIds);
                if (validation.valid && validation.discountAmount) {
                    discountAmount = validation.discountAmount;
                }
            }
            const totals = {
                ...cartTotals,
                shipping: 0,
                discount: discountAmount,
                total: Math.max(0, cartTotals.subtotal - discountAmount)
            };
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
            let customerAddress = null;
            if (customerId) {
                const { addressId } = req.query;
                let query = 'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1';
                let params = [customerId];
                if (addressId) {
                    query = 'SELECT * FROM customer_addresses WHERE customer_id = ? AND id = ?';
                    params = [customerId, addressId];
                }
                const [addresses] = await database_1.db.query(query, params);
                if (addresses && addresses.length > 0) {
                    const addr = addresses[0];
                    if (addr.content_encrypted && addr.iv) {
                        const decryptedData = encryptionService_1.default.decrypt(addr.content_encrypted, addr.iv, { quiet: true });
                        if (decryptedData) {
                            customerAddress = { ...addr, ...decryptedData };
                        }
                        else {
                            customerAddress = {
                                city: addr.city,
                                state: addr.state ?? '',
                                postal_code: addr.postal_code ?? '',
                                country: addr.country,
                                first_name: '', last_name: '', address_line_1: '', address_line_2: '', phone: ''
                            };
                        }
                    }
                    else {
                        customerAddress = addr;
                    }
                }
                else {
                    const [lastOrder] = await database_1.db.query('SELECT shipping_address FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1', [customerId]);
                    if (lastOrder && lastOrder.length > 0 && lastOrder[0].shipping_address) {
                        try {
                            customerAddress = typeof lastOrder[0].shipping_address === 'string'
                                ? JSON.parse(lastOrder[0].shipping_address)
                                : lastOrder[0].shipping_address;
                        }
                        catch (e) {
                            console.error('Error parsing last order address:', e);
                        }
                    }
                }
            }
            const paymentMethods = await paymentService_1.default.getActivePaymentMethods(undefined);
            const user = customerId ? await usersService_1.usersService.getUserById(customerId) : null;
            res.locals.pageTitle = 'Checkout';
            const cartItemsForOg = await cartService_1.default.getCartItems(cart.id);
            const checkoutOg = cartItemsForOg.find((i) => i.image_url && String(i.image_url).trim())?.image_url;
            if (checkoutOg)
                res.locals.pageImage = String(checkoutOg).trim();
            const metaInitiateCheckout = {
                value: totals.total,
                currency: ShopController.metaCurrency(res),
                content_ids: await (0, facebookCatalogId_1.resolveFacebookCatalogContentIdsForItems)(cartItemsForOg.map((i) => ({
                    product_id: i.product_id,
                    variant_id: i.variant_id ?? null
                })))
            };
            res.render('checkout', {
                cart,
                totals,
                metaInitiateCheckout,
                metaShopWarnings: metaShopWarnings.length > 0 ? metaShopWarnings : undefined,
                shippingRates: [],
                paymentMethods,
                customerId: customerId ?? undefined,
                address: customerAddress,
                user: user || undefined,
                appliedDiscountCode: cart.discount_code,
                countries
            });
        }
        catch (error) {
            console.error('Error rendering checkout page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async getShippingRates(req, res) {
        try {
            const isPost = req.method === 'POST';
            let country = (isPost ? req.body?.country : req.query?.country) ?? '';
            let city = (isPost ? req.body?.city : req.query?.city) ?? '';
            let state = (isPost ? req.body?.state : req.query?.state) ?? '';
            let postcode = (isPost ? req.body?.postcode : req.query?.postcode) ?? '';
            const sessionId = req.sessionID;
            const customerId = req.session.user?.id;
            const addressEmpty = !country || !country.trim();
            if (addressEmpty && customerId) {
                const [addresses] = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1', [customerId]);
                if (addresses && addresses.length > 0) {
                    const addr = addresses[0];
                    let resolved = addr;
                    if (addr.content_encrypted && addr.iv) {
                        const decryptedData = encryptionService_1.default.decrypt(addr.content_encrypted, addr.iv, { quiet: true });
                        if (decryptedData)
                            resolved = { ...addr, ...decryptedData };
                    }
                    country = resolved.country || country;
                    city = (resolved.city && resolved.city.trim()) ? resolved.city.trim() : city;
                    state = (resolved.state && resolved.state.trim()) ? resolved.state.trim() : state;
                    postcode = (resolved.postal_code && resolved.postal_code.trim()) ? resolved.postal_code.trim() : postcode;
                }
            }
            let cart;
            if (customerId) {
                cart = await cartService_1.default.getOrCreateCustomerCart(customerId);
            }
            else {
                cart = await cartService_1.default.getOrCreateSessionCart(sessionId);
            }
            const cartTotals = await cartService_1.default.getCartTotals(cart.id);
            let discountAmount = 0;
            if (cart.discount_code) {
                const cartItemsForDiscount = await cartService_1.default.getCartItems(cart.id);
                const productIds = cartItemsForDiscount.map((item) => item.product_id);
                const validation = await discountService_1.default.validateDiscountCode(cart.discount_code, cartTotals.subtotal, customerId || null, productIds);
                if (validation.valid && validation.discountAmount) {
                    discountAmount = validation.discountAmount;
                }
            }
            const cartItems = await cartService_1.default.getCartItems(cart.id);
            const cartSubtotal = Math.max(0, cartTotals.subtotal - discountAmount);
            const cartItemCount = cartTotals.itemCount;
            const cartTotalWeight = cartTotals.totalWeight ?? 0;
            const totalWeight = cartTotalWeight >= 0 ? cartTotalWeight : Math.max(0.5, 0);
            const hasAddress = !!(country && String(country).trim());
            let rates = [];
            let ratesError;
            if (hasAddress) {
                const available = await shippingService_1.default.getAvailableShippingRates({
                    subtotal: cartSubtotal,
                    totalPrice: cartSubtotal,
                    itemCount: cartItemCount,
                    totalWeight: totalWeight < 0.5 ? Math.max(0.5, totalWeight) : totalWeight,
                    country: country || 'LB',
                    city: city || '',
                    state: state || undefined,
                    postal_code: postcode || undefined,
                    items: cartItems
                });
                rates = available.rates;
                if (rates.length === 0)
                    ratesError = available.ratesError;
            }
            res.json({
                success: true,
                rates: Array.isArray(rates) ? rates : [],
                ...(ratesError ? { ratesError } : {}),
                cart: {
                    subtotal: cartTotals.subtotal,
                    itemCount: cartItemCount,
                    totalWeight: totalWeight,
                    discountAmount
                }
            });
        }
        catch (error) {
            const message = error?.message || String(error);
            console.error('Error getting shipping rates:', error);
            res.status(200).json({ success: false, error: message, rates: [], cart: null });
        }
    }
    static async getShippingCities(req, res) {
        try {
            const country = req.query.country?.trim() || '';
            const state = req.query.state?.trim() || '';
            const nameStartsWith = req.query.nameStartsWith?.trim() ?? req.query.q?.trim() ?? '';
            if (!country) {
                res.status(400).json({ success: false, error: 'country required', cities: [] });
                return;
            }
            const response = await (0, aramexApiClient_1.fetchCities)(country, state === '' ? undefined : state, nameStartsWith);
            if (response.HasErrors) {
                const notifs = response.Notifications?.Notification;
                const msg = Array.isArray(notifs) ? notifs.map((n) => n?.Message).filter(Boolean).join('; ') : 'Aramex error';
                res.status(200).json({ success: false, error: msg, cities: [] });
                return;
            }
            const raw = response.Cities;
            const cities = [];
            if (raw && typeof raw === 'object') {
                if (Array.isArray(raw.string)) {
                    raw.string.forEach((name) => cities.push({ name: String(name) }));
                }
                else if (Array.isArray(raw)) {
                    raw.forEach((c) => cities.push({ name: c?.Name || c?.name || String(c), code: c?.Code || c?.code }));
                }
                else {
                    const arr = raw.City;
                    if (Array.isArray(arr)) {
                        arr.forEach((c) => cities.push({ name: c?.Name || c?.name || String(c), code: c?.Code || c?.code }));
                    }
                }
            }
            cities.sort((a, b) => a.name.localeCompare(b.name));
            res.json({ success: true, cities });
        }
        catch (error) {
            console.error('Error fetching cities:', error);
            res.status(500).json({ success: false, error: error?.message || 'Failed to fetch cities', cities: [] });
        }
    }
    static async getShippingStates(req, res) {
        try {
            const country = req.query.country?.trim().toUpperCase() || '';
            if (country !== 'US' && country !== 'USA') {
                res.json({ success: true, states: [] });
                return;
            }
            const response = await (0, aramexApiClient_1.fetchStates)('US');
            if (response.HasErrors) {
                const notifs = response.Notifications?.Notification;
                const msg = Array.isArray(notifs) ? notifs.map((n) => n?.Message).filter(Boolean).join('; ') : 'Aramex error';
                res.status(200).json({ success: false, error: msg, states: [] });
                return;
            }
            const raw = response.States;
            const states = [];
            if (raw && typeof raw === 'object') {
                if (Array.isArray(raw.string)) {
                    raw.string.forEach((name) => states.push({ name: String(name) }));
                }
                else if (Array.isArray(raw)) {
                    raw.forEach((s) => states.push({ name: s?.Name || s?.name || String(s), code: s?.Code || s?.code }));
                }
                else {
                    const arr = raw.State;
                    if (Array.isArray(arr)) {
                        arr.forEach((s) => states.push({ name: s?.Name || s?.name || String(s), code: s?.Code || s?.code }));
                    }
                }
            }
            states.sort((a, b) => a.name.localeCompare(b.name));
            res.json({ success: true, states });
        }
        catch (error) {
            console.error('Error fetching states:', error);
            res.status(500).json({ success: false, error: error?.message || 'Failed to fetch states', states: [] });
        }
    }
    static async getCheckoutPaymentMethods(req, res) {
        try {
            const country = (req.query?.country ?? '');
            const paymentMethods = await paymentService_1.default.getActivePaymentMethods(country.trim() || undefined);
            res.json({ success: true, paymentMethods });
        }
        catch (error) {
            console.error('Error getting checkout payment methods:', error);
            res.status(500).json({ success: false, error: error?.message || 'Server error', paymentMethods: [] });
        }
    }
    static async cancelOrderAndRestoreToCart(req, res, orderId) {
        const order = await orderService_1.default.getOrderById(orderId);
        if (!order || order.payment_status === 'paid') {
            res.redirect('/cart');
            return;
        }
        if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
            return;
        }
        const customerId = req.session.user?.id;
        const sessionId = req.sessionID;
        const cart = customerId
            ? await cartService_1.default.getOrCreateCustomerCart(customerId)
            : await cartService_1.default.getOrCreateSessionCart(sessionId);
        const items = await orderService_1.default.getOrderItems(orderId);
        const cartItems = items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price
        }));
        await cartService_1.default.addOrderItemsToCart(cart.id, cartItems);
        await orderService_1.default.updateOrderStatus(orderId, 'cancelled');
        await orderService_1.default.updatePaymentStatus(orderId, 'failed');
        await orderService_1.default.addOrderNote(orderId, 'Payment cancelled by user – items restored to cart');
        res.redirect('/cart?cancelled=1');
    }
    static async checkoutPay(req, res) {
        try {
            const sessionId = req.query.sessionId || '';
            const orderId = parseInt(req.query.orderId || '0', 10);
            if (!sessionId || !orderId) {
                res.redirect('/checkout?error=missing_session_or_order');
                return;
            }
            const order = await orderService_1.default.getOrderById(orderId);
            if (!order) {
                res.redirect('/checkout?error=order_not_found');
                return;
            }
            if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
                return;
            }
            if (order.payment_status === 'paid') {
                res.redirect(`/order-success?orderNumber=${order.order_number}`);
                return;
            }
            const session = req.session;
            const payPageShown = session.payPageShownOrderIds && session.payPageShownOrderIds[orderId];
            if (payPageShown) {
                delete session.payPageShownOrderIds[orderId];
                await ShopController.cancelOrderAndRestoreToCart(req, res, orderId);
                return;
            }
            session.payPageShownOrderIds = session.payPageShownOrderIds || {};
            session.payPageShownOrderIds[orderId] = true;
            const appBaseUrl = (0, currentUrlProviderService_1.getBaseUrl)(req);
            const completeUrl = `${appBaseUrl}/checkout/complete?orderId=${orderId}`;
            const cancelUrl = `${appBaseUrl}/checkout/cancel?orderId=${orderId}`;
            const gatewayUrl = env_config_1.envConfig.netcommerce.gatewayUrl || '';
            const gatewayScriptBaseUrl = gatewayUrl.split('/api')[0].replace(/\/$/, '');
            res.locals.pageTitle = 'Payment';
            res.render('checkout-pay', {
                sessionId,
                orderId,
                completeUrl,
                cancelUrl,
                gatewayScriptBaseUrl
            });
        }
        catch (error) {
            console.error('Error rendering checkout pay page:', error);
            res.redirect('/checkout?error=pay_page_failed');
        }
    }
    static async checkoutComplete(req, res) {
        try {
            console.log('[Checkout Complete] Bank return – query:', JSON.stringify(req.query));
            if (req.body && Object.keys(req.body).length > 0) {
                console.log('[Checkout Complete] Bank return – body:', JSON.stringify(req.body));
            }
            const orderId = parseInt(req.query.orderId || '0', 10);
            if (!orderId) {
                res.redirect('/checkout?error=missing_order');
                return;
            }
            const order = await orderService_1.default.getOrderById(orderId);
            if (!order) {
                res.redirect('/shop?error=order_not_found');
                return;
            }
            if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
                return;
            }
            if (order.payment_status === 'paid') {
                res.redirect(`/order-success?orderNumber=${order.order_number}`);
                return;
            }
            const transactions = await paymentService_1.default.getOrderTransactions(orderId);
            const pendingTx = transactions.find((t) => t.status === 'pending' && t.payment_method_code === 'netcommerce');
            if (!pendingTx || !pendingTx.gateway_response) {
                await orderService_1.default.updateOrderStatus(orderId, 'failed');
                await orderService_1.default.updatePaymentStatus(orderId, 'failed');
                await orderService_1.default.addOrderNote(orderId, 'Payment failed - Code: NO_PENDING_PAYMENT, Description: No pending payment transaction found');
                res.redirect(`/order-error?orderNumber=${order.order_number}`);
                return;
            }
            let gatewayResponse;
            try {
                gatewayResponse = typeof pendingTx.gateway_response === 'string'
                    ? JSON.parse(pendingTx.gateway_response) : pendingTx.gateway_response;
            }
            catch {
                await orderService_1.default.updatePaymentStatus(orderId, 'failed');
                await orderService_1.default.addOrderNote(orderId, 'Payment failed - Code: INVALID_SESSION, Description: Invalid session data');
                res.redirect(`/order-error?orderNumber=${order.order_number}`);
                return;
            }
            const gatewayOrderId = gatewayResponse?.gatewayOrderId || gatewayResponse?.order?.id;
            const sessionId = gatewayResponse?.session?.id;
            if (!gatewayOrderId && !sessionId) {
                await orderService_1.default.updateOrderStatus(orderId, 'failed');
                await orderService_1.default.updatePaymentStatus(orderId, 'failed');
                await orderService_1.default.addOrderNote(orderId, 'Payment failed - Code: NO_SESSION, Description: No session or gateway order id in gateway response');
                res.redirect(`/order-error?orderNumber=${order.order_number}`);
                return;
            }
            const netcommerce = new netcommerceService_1.default();
            const isMockSession = sessionId?.startsWith('mock-session-');
            let orderResult = { success: false };
            if (isMockSession && process.env.NODE_ENV === 'development') {
                orderResult = { success: true, result: 'SUCCESS', status: 'CAPTURED' };
                console.log('[Checkout Complete] Mock session – orderId:', orderId, 'orderResult:', JSON.stringify(orderResult));
            }
            else if (gatewayOrderId) {
                orderResult = await netcommerce.retrieveOrder(gatewayOrderId);
                console.log('[Checkout Complete] Retrieve Order – orderId:', orderId, 'gatewayOrderId:', gatewayOrderId, 'orderResult:', JSON.stringify(orderResult));
            }
            else if (sessionId) {
                const sessionResult = await netcommerce.retrieveSession(sessionId);
                const ok = sessionResult.success && (sessionResult.result === 'SUCCESS');
                orderResult = {
                    success: ok,
                    ...(sessionResult.result != null && { result: sessionResult.result }),
                    ...(sessionResult.order?.status != null && { status: sessionResult.order.status }),
                    ...(sessionResult.order != null && { order: sessionResult.order }),
                    ...(sessionResult.error != null && { error: sessionResult.error })
                };
                console.log('[Checkout Complete] Retrieve Session (fallback) – orderId:', orderId, 'sessionResult:', JSON.stringify(sessionResult));
            }
            if (!orderResult.success) {
                const errorCode = orderResult.result || orderResult.status || 'UNKNOWN';
                const errorDesc = orderResult.error || 'Payment could not be completed';
                await orderService_1.default.updateOrderStatus(orderId, 'failed');
                await orderService_1.default.updatePaymentStatus(orderId, 'failed');
                await orderService_1.default.addOrderNote(orderId, `Payment failed - Code: ${errorCode}, Description: ${errorDesc}`);
                res.redirect(`/order-error?orderNumber=${order.order_number}`);
                return;
            }
            await orderService_1.default.updatePaymentStatus(orderId, 'paid');
            if (order.status === 'verifying') {
                await orderService_1.default.updateOrderStatus(orderId, 'pending');
            }
            const completionPayload = {
                bankReturnQuery: req.query,
                bankReturnBody: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
                retrievedOrder: orderResult
            };
            const updatedGatewayResponse = { ...gatewayResponse, completion: completionPayload };
            await database_1.db.query(`UPDATE transactions SET status = ?, gateway_response = ?, processed_at = NOW(), updated_at = NOW() WHERE id = ?`, ['completed', JSON.stringify(updatedGatewayResponse), pendingTx.id]);
            try {
                const orderItems = await orderService_1.default.getOrderItems(orderId);
                const shippingAddress = typeof order.shipping_address === 'string'
                    ? JSON.parse(order.shipping_address) : order.shipping_address;
                const emailItems = orderItems.map((item) => ({
                    name: item.variant_name ? `${item.product_name || 'Product'} (${item.variant_name})` : (item.product_name || 'Product'),
                    quantity: item.quantity,
                    price: Number(item.unit_price)
                }));
                const settingsService = ecommerceSettingsService_1.EcommerceSettingsService.getInstance();
                const settings = await settingsService.getSettings();
                const storeEmail = settings.store_email || process.env.SMTP_FROM || 'admin@example.com';
                const num = (v) => Number(v) || 0;
                await emailService_1.default.sendOrderConfirmation(order.order_number, order.customer_email, shippingAddress?.first_name && shippingAddress?.last_name
                    ? `${shippingAddress.first_name} ${shippingAddress.last_name}` : 'Customer', {
                    items: emailItems,
                    subtotal: num(order.subtotal),
                    tax: num(order.tax_amount),
                    shipping: num(order.shipping_amount),
                    discount: num(order.discount_amount),
                    total: num(order.total_amount),
                    shippingAddress: shippingAddress || {}
                });
                await emailService_1.default.sendNewOrderNotification(storeEmail, order.order_number, shippingAddress?.first_name && shippingAddress?.last_name
                    ? `${shippingAddress.first_name} ${shippingAddress.last_name}` : 'Customer', order.customer_email, {
                    items: emailItems,
                    total: num(order.total_amount),
                    subtotal: num(order.subtotal),
                    shipping: num(order.shipping_amount),
                    shippingAddress: shippingAddress || {}
                });
            }
            catch (emailError) {
                console.error('Error sending order confirmation after payment:', emailError);
            }
            res.redirect(`/order-success?orderNumber=${order.order_number}`);
        }
        catch (error) {
            console.error('Error in checkout complete:', error);
            const orderId = parseInt(req.query.orderId || '0', 10);
            if (orderId) {
                try {
                    const order = await orderService_1.default.getOrderById(orderId);
                    if (order) {
                        const errMsg = error?.message || String(error);
                        await orderService_1.default.updateOrderStatus(orderId, 'failed');
                        await orderService_1.default.updatePaymentStatus(orderId, 'failed');
                        await orderService_1.default.addOrderNote(orderId, `Payment failed - Code: CALLBACK_ERROR, Description: ${errMsg}`);
                        res.redirect(`/order-error?orderNumber=${order.order_number}`);
                        return;
                    }
                }
                catch (logErr) {
                    console.error('Error logging payment failure:', logErr);
                }
            }
            res.redirect('/checkout?error=payment_callback_failed');
        }
    }
    static async checkoutCancel(req, res) {
        const orderIdRaw = req.query.orderId;
        const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : 0;
        if (orderId && !isNaN(orderId)) {
            await ShopController.cancelOrderAndRestoreToCart(req, res, orderId);
        }
        else {
            res.redirect('/cart?cancelled=1');
        }
    }
    static async orderSuccess(req, res) {
        try {
            const { orderNumber } = req.query;
            if (!orderNumber) {
                res.redirect('/shop');
                return;
            }
            let order = await orderService_1.default.getOrderByNumber(orderNumber);
            if (!order) {
                res.redirect('/shop?error=order_not_found');
                return;
            }
            const customerId = req.session.user?.id;
            const sessionEmail = req.session.user?.email;
            if (customerId != null && sessionEmail && order.customer_id == null &&
                order.customer_email.trim().toLowerCase() === sessionEmail.trim().toLowerCase()) {
                await orderService_1.default.attachGuestOrdersToCustomer(customerId, sessionEmail);
                order = (await orderService_1.default.getOrderByNumber(orderNumber));
            }
            if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
                return;
            }
            const orderWithItems = await orderService_1.default.getOrderWithItems(order.id);
            const orderItems = orderWithItems?.items || [];
            const metaPurchase = orderWithItems
                ? {
                    value: orderWithItems.total_amount,
                    currency: orderWithItems.currency || ShopController.metaCurrency(res),
                    content_ids: await (0, facebookCatalogId_1.resolveFacebookCatalogContentIdsForItems)(orderItems.map((i) => ({
                        product_id: i.product_id,
                        variant_id: i.variant_id ?? null
                    })))
                }
                : undefined;
            res.locals.pageTitle = 'Order Confirmed';
            res.render('order-success', {
                orderNumber: order.order_number,
                metaPurchase
            });
        }
        catch (error) {
            console.error('Error rendering order success page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async orderError(req, res) {
        try {
            const { orderNumber } = req.query;
            if (!orderNumber) {
                res.redirect('/checkout?error=missing_order');
                return;
            }
            const order = await orderService_1.default.getOrderByNumber(orderNumber);
            if (!order) {
                res.redirect('/shop?error=order_not_found');
                return;
            }
            if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
                return;
            }
            res.locals.pageTitle = 'Order Error';
            res.render('order-error', {
                orderNumber: order.order_number
            });
        }
        catch (error) {
            console.error('Error rendering order error page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async processCheckout(req, res) {
        try {
            const sessionId = req.sessionID;
            const customerId = req.session.user?.id;
            const { shipping_address, billing_address, shipping_method_id, payment_method_id, discount_code, selected_shipping_cost: frontendShippingCost } = req.body;
            if (!shipping_address || typeof shipping_address !== 'object') {
                res.status(400).json({ success: false, error: 'Shipping address is required' });
                return;
            }
            if (!shipping_address.email) {
                res.status(400).json({ success: false, error: 'Email is required' });
                return;
            }
            if (!payment_method_id) {
                res.status(400).json({ success: false, error: 'Please select a payment method' });
                return;
            }
            let cart;
            if (customerId) {
                cart = await cartService_1.default.getOrCreateCustomerCart(customerId);
            }
            else {
                cart = await cartService_1.default.getOrCreateSessionCart(sessionId);
            }
            const cartItems = await cartService_1.default.getCartItems(cart.id);
            const cartTotals = await cartService_1.default.getCartTotals(cart.id);
            if (cartItems.length === 0) {
                res.status(400).json({ error: 'Cart is empty' });
                return;
            }
            let discountAmount = 0;
            let discountId = null;
            let finalDiscountCode = discount_code;
            if (!finalDiscountCode && cart.discount_code) {
                finalDiscountCode = cart.discount_code;
            }
            if (finalDiscountCode) {
                const productIds = cartItems.map(item => item.product_id);
                const validation = await discountService_1.default.validateDiscountCode(finalDiscountCode, cartTotals.subtotal, customerId || null, productIds);
                if (validation.valid && validation.discountAmount) {
                    discountAmount = validation.discountAmount;
                    discountId = validation.discount.id;
                }
            }
            const totalBeforeShipping = Math.max(0, cartTotals.subtotal - discountAmount);
            let shippingAmount = 0;
            if (shipping_method_id) {
                const rateId = parseInt(shipping_method_id, 10);
                const shippingRate = await shippingService_1.default.getShippingRateById(rateId);
                if (shippingRate) {
                    const addressLine = shipping_address.address ?? shipping_address.address_line1 ?? '';
                    shippingAmount = await shippingService_1.default.calculateShippingCost(shippingRate.id, {
                        subtotal: cartTotals.subtotal,
                        totalPrice: totalBeforeShipping,
                        itemCount: cartTotals.itemCount,
                        totalWeight: cartTotals.totalWeight || 0,
                        country: shipping_address.country || 'LB',
                        city: shipping_address.city,
                        address: addressLine,
                        items: cartItems
                    });
                }
                else {
                    const available = await shippingService_1.default.getAvailableShippingRates({
                        subtotal: cartTotals.subtotal,
                        totalPrice: totalBeforeShipping,
                        itemCount: cartTotals.itemCount,
                        totalWeight: cartTotals.totalWeight || 0,
                        country: shipping_address.country || 'LB',
                        city: shipping_address.city || '',
                        state: shipping_address.state,
                        postal_code: shipping_address.postal_code || shipping_address.zip_code,
                        items: cartItems
                    });
                    const availableRates = available.rates;
                    const match = Array.isArray(availableRates) ? availableRates.find((r) => r.rate && Number(r.rate.id) === rateId) : null;
                    if (match != null && typeof match.cost === 'number') {
                        shippingAmount = match.cost;
                    }
                    else {
                        const sentCost = Number(frontendShippingCost);
                        if (!isNaN(sentCost) && sentCost >= 0 && sentCost <= 10000) {
                            shippingAmount = sentCost;
                        }
                    }
                }
            }
            const taxAmount = 0;
            const finalTotal = Math.max(0, cartTotals.subtotal + shippingAmount + taxAmount - discountAmount);
            const paymentMethod = await paymentService_1.default.getPaymentMethodById(parseInt(payment_method_id));
            const countryCode = shipping_address.country ? String(shipping_address.country).trim() : '';
            const allowedMethods = await paymentService_1.default.getActivePaymentMethods(countryCode || undefined);
            const allowedIds = allowedMethods.map((m) => m.id);
            if (!paymentMethod || !allowedIds.includes(paymentMethod.id)) {
                res.status(400).json({
                    success: false,
                    error: 'The selected payment method is not available for this country. Lebanon: Pay on delivery only. Other countries: Pay by card only.'
                });
                return;
            }
            const orderData = {
                customer_id: customerId || null,
                customer_email: shipping_address.email,
                customer_phone: shipping_address.phone ? shipping_address.phone : undefined,
                shipping_address,
                billing_address: billing_address || shipping_address,
                items: cartItems.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                subtotal: cartTotals.subtotal,
                tax_amount: taxAmount,
                shipping_amount: shippingAmount,
                discount_amount: discountAmount,
                total_amount: finalTotal,
                payment_method: paymentMethod?.code || 'unknown'
            };
            if (shipping_method_id) {
                orderData.shipping_method = `shipping_${shipping_method_id}`;
            }
            if (discountId) {
                orderData.discount_code = finalDiscountCode;
            }
            const order = await orderService_1.default.createOrder(orderData);
            if (discountId && discountAmount > 0) {
                await discountService_1.default.recordDiscountUsage(discountId, order.id, customerId || null, discountAmount);
            }
            const appBaseUrl = (0, currentUrlProviderService_1.getBaseUrl)(req);
            const billingForGateway = billing_address || shipping_address;
            const customerNameForGateway = [billingForGateway?.first_name, billingForGateway?.last_name].filter(Boolean).join(' ') || undefined;
            const paymentData = {
                orderId: order.id,
                amount: finalTotal,
                currency: 'USD',
                customerEmail: shipping_address.email,
                billingAddress: billingForGateway ? {
                    address1: billingForGateway.address_line1 || billingForGateway.street,
                    address2: billingForGateway.address_line2,
                    city: billingForGateway.city,
                    state: billingForGateway.state,
                    postal_code: billingForGateway.postal_code || billingForGateway.zip_code,
                    country: billingForGateway.country,
                    country_code: billingForGateway.country
                } : undefined,
                paymentMethodId: parseInt(payment_method_id),
                returnUrl: `${appBaseUrl}/checkout/complete?orderId=${order.id}`,
                cancelUrl: `${appBaseUrl}/checkout/cancel?orderId=${order.id}`,
                baseUrl: appBaseUrl
            };
            if (typeof customerNameForGateway === 'string')
                paymentData.customerName = customerNameForGateway;
            if (shipping_address.phone)
                paymentData.customerPhone = shipping_address.phone;
            const paymentResult = await paymentService_1.default.processPayment(paymentData);
            if (paymentResult.success) {
                await cartService_1.default.clearCart(cart.id);
                await cartService_1.default.setCartDiscount(cart.id, null);
                if (paymentResult.redirectUrl) {
                    await orderService_1.default.updateOrderStatus(order.id, 'verifying');
                }
            }
            else {
                res.json({ success: false, error: paymentResult.error });
                return;
            }
            if (!paymentResult.redirectUrl) {
                (async () => {
                    try {
                        const orderItems = await orderService_1.default.getOrderItems(order.id);
                        const emailItems = orderItems.map(item => ({
                            name: item.variant_name ? `${item.product_name || 'Product'} (${item.variant_name})` : (item.product_name || 'Product'),
                            quantity: item.quantity,
                            price: Number(item.unit_price)
                        }));
                        const settingsService = ecommerceSettingsService_1.EcommerceSettingsService.getInstance();
                        const settings = await settingsService.getSettings();
                        const storeEmail = settings.store_email || process.env.SMTP_FROM || 'admin@example.com';
                        await emailService_1.default.sendOrderConfirmation(order.order_number, shipping_address.email, `${shipping_address.first_name} ${shipping_address.last_name}`, {
                            items: emailItems,
                            subtotal: cartTotals.subtotal,
                            tax: taxAmount,
                            shipping: shippingAmount,
                            discount: discountAmount,
                            total: finalTotal,
                            shippingAddress: shipping_address
                        });
                        await emailService_1.default.sendNewOrderNotification(storeEmail, order.order_number, `${shipping_address.first_name} ${shipping_address.last_name}`, shipping_address.email, {
                            items: emailItems,
                            total: finalTotal,
                            subtotal: cartTotals.subtotal,
                            shipping: shippingAmount,
                            shippingAddress: shipping_address
                        });
                    }
                    catch (emailError) {
                        console.error('Error sending order emails:', emailError);
                    }
                })();
            }
            const paymentDebugEnabled = process.env.PAYMENT_DEBUG === 'true' || process.env.PAYMENT_DEBUG === '1';
            res.json({
                success: true,
                orderNumber: order.order_number,
                orderId: order.id,
                redirectUrl: paymentResult.redirectUrl,
                bankDebugReport: paymentResult.bankDebugReport ?? undefined,
                paymentDebugEnabled
            });
        }
        catch (error) {
            console.error('Error processing checkout:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process checkout'
            });
        }
    }
    static async validateDiscount(req, res) {
        try {
            const { code, subtotal } = req.body;
            const customerId = req.session.user?.id;
            const sessionId = req.sessionID;
            let cart;
            if (customerId) {
                cart = await cartService_1.default.getOrCreateCustomerCart(customerId);
            }
            else {
                cart = await cartService_1.default.getOrCreateSessionCart(sessionId);
            }
            const cartItems = await cartService_1.default.getCartItems(cart.id);
            const productIds = cartItems.map(item => item.product_id);
            const validation = await discountService_1.default.validateDiscountCode(code, parseFloat(subtotal), customerId || null, productIds);
            if (validation.valid) {
                await cartService_1.default.setCartDiscount(cart.id, code);
            }
            res.json(validation);
        }
        catch (error) {
            console.error('Error validating discount:', error);
            res.status(500).json({ error: 'Failed to validate discount code' });
        }
    }
    static async submitReview(req, res) {
        try {
            const { product_id, rating, review_text, reviewer_name, reviewer_email, title, cf_turnstile_response } = req.body;
            const customerId = req.session.user?.id;
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
            if (!product_id || !rating || !review_text || !reviewer_name) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            if (rating < 1 || rating > 5) {
                res.status(400).json({ error: 'Rating must be between 1 and 5' });
                return;
            }
            const review = await reviewService_1.default.submitReview(parseInt(product_id), {
                customer_id: customerId || null,
                reviewer_name,
                reviewer_email: reviewer_email || null,
                rating: parseInt(rating),
                title: title || null,
                review_text
            });
            res.json({ success: true, review, message: 'Review submitted successfully. It will be published after approval.' });
        }
        catch (error) {
            console.error('Error submitting review:', error);
            res.status(500).json({ error: 'Failed to submit review' });
        }
    }
    static async getReviews(req, res) {
        try {
            const { product_id } = req.params;
            const { limit, offset } = req.query;
            const reviewOptions = {
                approvedOnly: true
            };
            if (limit)
                reviewOptions.limit = parseInt(limit);
            if (offset)
                reviewOptions.offset = parseInt(offset);
            const reviews = await reviewService_1.default.getProductReviews(parseInt(product_id), reviewOptions);
            res.json({ success: true, reviews });
        }
        catch (error) {
            console.error('Error getting reviews:', error);
            res.status(500).json({ error: 'Failed to get reviews' });
        }
    }
    static async getProductDetails(req, res) {
        try {
            const { id } = req.params;
            const product = await productService_1.default.getProductWithDetails(parseInt(id));
            if (!product) {
                res.status(404).json({ success: false, error: 'Product not found' });
                return;
            }
            const productAttributeService = productAttributeService_1.ProductAttributeService.getInstance();
            const productAttributes = await productAttributeService.getProductAttributes(product.id);
            const variantDisplay = (0, variantDisplayService_1.buildVariantDisplayModel)(product, product.variants || [], productAttributes);
            res.json({
                success: true,
                product,
                productAttributes,
                variantDisplay
            });
        }
        catch (error) {
            console.error('Error getting product details API:', error);
            res.status(500).json({ success: false, error: 'Failed to get product details' });
        }
    }
}
exports.ShopController = ShopController;
//# sourceMappingURL=shopController.js.map