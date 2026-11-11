import { Request, Response } from 'express';
import productService, { attachMultiPriceListingFieldsForProduct } from '../services/productService';
import categoryService from '../services/categoryService';
import cartService from '../services/cartService';
import orderService from '../services/orderService';
import discountService from '../services/discountService';
import shippingService from '../services/shippingService';
import paymentService from '../services/paymentService';
import NetCommerceService from '../services/paymentGateways/netcommerceService';
import reviewService from '../services/reviewService';
import { ProductAttributeService } from '../../admin/services/productAttributeService';
import emailService from '../services/emailService';
import { EcommerceSettingsService } from '../../admin/services/ecommerceSettingsService';
import { db } from '../config/database';
import { envConfig } from '../config/env.config';
import { verifyTurnstileToken } from '../utils/turnstile';
import { getDataFilePath } from '../constants/data-paths';
import * as fs from 'fs';
import encryptionService from '../services/encryptionService';
import { getBaseUrl } from '../services/currentUrlProviderService';
import { usersService } from '../../admin/services/usersService';
import type { Order } from '../services/orderService';
import { fetchCities, fetchStates } from '../aramex/aramexApiClient';
import { buildVariantDisplayModel } from '../services/variantDisplayService';
import { ogImageUrlFromProduct, ogImageUrlFromProductList } from '../utils/productOgImage';
import {
  parseMetaShopProductsParam,
  resolveFacebookCatalogContentId,
  resolveFacebookCatalogContentIdFromDb,
  resolveFacebookCatalogContentIdsForItems,
  resolveProductVariantFromCatalogContentId
} from '../utils/facebookCatalogId';

export class ShopController {
  private static metaCurrency(res: Response): string {
    const settings = (res.locals as any).ecommerceSettings;
    return settings?.currency?.trim() || 'USD';
  }

  /**
   * Ensures the order belongs to the current user (logged-in customer or guest).
   * If not, sends redirect and returns false. Call this on order-success, order-error, and checkout/complete.
   */
  private static async ensureOrderBelongsToUser(req: Request, res: Response, order: Order): Promise<boolean> {
    const customerId = (req.session as any).user?.id as number | undefined;
    const orderCustomerId = order.customer_id ?? null;

    if (customerId !== undefined && customerId !== null) {
      // Logged-in user: order must belong to this customer
      if (orderCustomerId !== customerId) {
        res.redirect('/shop?error=access_denied');
        return false;
      }
    } else {
      // Guest: only allow access to guest orders (no customer_id)
      if (orderCustomerId !== null) {
        res.redirect('/shop?error=access_denied');
        return false;
      }
    }
    return true;
  }

  /**
   * Shop listing page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      // Get route params for SEO-friendly URLs
      const categorySlug = req.params.categorySlug;
      const brandSlug = req.params.brandSlug;

      // Get query params
      const {
        search,
        min_price,
        max_price,
        featured,
        page = '1',
        limit = '40',
        sort_by = 'created_at',
        sort_order = 'DESC',
        ...attributeParams
      } = req.query;

      const categories = await categoryService.getCategoryTree();
      const productAttributeService = ProductAttributeService.getInstance();
      const allAttributes = await productAttributeService.getAllProductAttributes(false);

      // Extract attribute filters from query params
      const attributeFilters: any = {};
      allAttributes.forEach(attr => {
        if (attributeParams[attr.slug]) {
          attributeFilters[attr.slug] = (attributeParams[attr.slug] as string).split(',');
        }
      });

      // Check if any filters are applied
      const hasFilters = !!(categorySlug || brandSlug || search || min_price || max_price || featured || Object.keys(attributeFilters).length > 0);
      const isProductsPage = req.path === '/products';

      if (!hasFilters && !isProductsPage) {
        (res.locals as any).pageTitle = 'Shop';
        const fp = (res.locals as any).randomFeaturedProduct;
        const ogFeatured = fp ? ogImageUrlFromProduct(fp) : '';
        if (ogFeatured) (res.locals as any).pageImage = ogFeatured;
        res.render('shop', {
          showCategoriesGrid: true,
          categories,
          filters: {}
        });
        return;
      }

      // Optimization: Fetch ALL potential products in one single broad query
      // We exclude price filters and pagination from the DB query to allow in-memory calc
      const baseFilters: any = {
        is_active: true,
        status: 'published',
        sort_by: sort_by as any,
        sort_order: sort_order as 'ASC' | 'DESC',
        // Fetch a large number to emulate "all" matching products
        page: 1,
        limit: 100000
      };

      let categoryData: { id: number; name: string; meta_description?: string | null } | null = null;
      if (categorySlug) {
        categoryData = await categoryService.getCategoryBySlug(categorySlug);
        if (categoryData) baseFilters.category_id = categoryData.id;
      }

      if (brandSlug) {
        const brandService = (await import('../services/brandService')).default;
        const brandData = await brandService.getBrandBySlug(brandSlug);
        if (brandData) baseFilters.brand_id = brandData.id;
      }

      if (search) baseFilters.search = search as string;
      if (featured === 'true') baseFilters.is_featured = true;
      if (Object.keys(attributeFilters).length > 0) baseFilters.attributes = attributeFilters;

      // Fetch all matching products (broad match)
      const allMatchesResult = await productService.getProducts(baseFilters);
      let allProducts = allMatchesResult.products;

      // 1. Calculate Price Range from ALL matches (before price filtering)
      let priceRange = { min: 0, max: 0 };
      if (allProducts.length > 0) {
        const prices = allProducts.map(p => Number(p.price));
        priceRange = {
          min: Math.floor(Math.min(...prices)),
          max: Math.ceil(Math.max(...prices))
        };
      }

      // 2. Filter by Price (In-Memory)
      let filteredProducts = allProducts;
      if (min_price) {
        const min = parseFloat(min_price as string);
        filteredProducts = filteredProducts.filter(p => Number(p.price) >= min);
      }
      if (max_price) {
        const max = parseFloat(max_price as string);
        filteredProducts = filteredProducts.filter(p => Number(p.price) <= max);
      }

      // 3. Calculate Available Filters (using filtered set)
      const availableFilters = await ShopController.calculateAvailableFilters(baseFilters, filteredProducts);

      // When on a subcategory page, ensure all sister categories are visible as filters.
      // calculateAvailableFilters only returns categories present in the current result set,
      // so sisters that have no products in this filtered view would otherwise be hidden.
      if (categoryData && (categoryData as any).parent_id) {
        const parentId = (categoryData as any).parent_id;
        const findCategoryInTree = (cats: any[], id: number): any | null => {
          for (const cat of cats) {
            if (cat.id === id) return cat;
            if (cat.children && cat.children.length > 0) {
              const found = findCategoryInTree(cat.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const parentCategory = findCategoryInTree(categories, parentId);
        if (parentCategory) {
          const idx = availableFilters.categories.findIndex((c: any) => c.id === parentId);
          if (idx !== -1) {
            // Replace partial parent entry with the full one from the tree (all children intact)
            availableFilters.categories[idx] = parentCategory;
          } else {
            availableFilters.categories.unshift(parentCategory);
          }
        }
      }

      // Fallback for categories/attributes
      if (!availableFilters.categories || availableFilters.categories.length === 0) {
        availableFilters.categories = categories;
      }
      if (!availableFilters.attributes || availableFilters.attributes.length === 0) {
        // Simple logic: if we have matches but no attrs, show none. 
        // If no matches, show all so user can reset.
        if (filteredProducts.length === 0 && hasFilters) {
          availableFilters.attributes = allAttributes;
        } else if (!hasFilters) {
          availableFilters.attributes = allAttributes;
        }
      }

      // 4. Pagination (In-Memory)
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const total = filteredProducts.length;
      const totalPages = Math.ceil(total / limitNum);
      const offset = (pageNum - 1) * limitNum;

      const productsToRender = filteredProducts.slice(offset, offset + limitNum);

      await productService.attachColorOptionsForListing(productsToRender);

      // SEO: page title and description for category or all products
      if (categoryData) {
        (res.locals as any).pageTitle = categoryData.name;
        (res.locals as any).pageDescription = categoryData.meta_description || '';
      } else if (brandSlug) {
        const brandService = (await import('../services/brandService')).default;
        const brandData = await brandService.getBrandBySlug(brandSlug);
        (res.locals as any).pageTitle = brandData?.name || 'Brand';
        (res.locals as any).pageDescription = (brandData as any)?.meta_description || '';
      } else if (isProductsPage) {
        (res.locals as any).pageTitle = 'All Products';
      } else if (search) {
        (res.locals as any).pageTitle = `Search: ${search}`;
      }

      let shopOgImage = ogImageUrlFromProductList(productsToRender);
      if (!shopOgImage && categoryData && String((categoryData as any).image_url || '').trim()) {
        shopOgImage = String((categoryData as any).image_url).trim();
      }
      if (!shopOgImage && brandSlug) {
        const brandService = (await import('../services/brandService')).default;
        const bd = await brandService.getBrandBySlug(brandSlug);
        if (bd?.logo_url) shopOgImage = bd.logo_url;
      }
      if (shopOgImage) (res.locals as any).pageImage = shopOgImage;

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
        currentBrand: brandSlug,
        isProductsPage: isProductsPage,
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

    } catch (error) {
      console.error('Error rendering shop page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Calculate available filters based on filtered products
   */
  private static async calculateAvailableFilters(
    currentFilters: any,
    products: any[]
  ): Promise<{ categories: any[]; attributes: any[] }> {
    try {
      if (products.length === 0) {
        return { categories: [], attributes: [] };
      }

      const productIds = products.map(p => p.id);

      // Get available categories from filtered products
      const [categoryRows] = await db.query<any>(
        `SELECT DISTINCT pc.id, pc.name, pc.slug, pc.parent_id
         FROM product_categories pc
         JOIN product_category_relations pcr ON pc.id = pcr.category_id
         WHERE pcr.product_id IN (?)
         ORDER BY pc.name`,
        [productIds]
      );

      // Build category tree from available categories
      const categoryMap = new Map();
      categoryRows.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });

      const rootCategories: any[] = [];
      categoryRows.forEach(cat => {
        const category = categoryMap.get(cat.id);
        if (cat.parent_id && categoryMap.has(cat.parent_id)) {
          categoryMap.get(cat.parent_id).children.push(category);
        } else {
          rootCategories.push(category);
        }
      });

      // Get available attribute values from filtered products
      const [attributeRows] = await db.query<any>(
        `SELECT DISTINCT 
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
         ORDER BY vt.display_order, vt.name, vtv.display_order, vtv.value`,
        [JSON.stringify([0]), productIds] // Placeholder, will need to check each value
      );

      // Get all product attributes and their selected values
      const [productAttrRows] = await db.query<any>(
        `SELECT pa.product_id, pa.variant_type_id, pa.selected_values
         FROM product_attributes pa
         WHERE pa.product_id IN (?)`,
        [productIds]
      );

      // Get all variant types
      const [allVariantTypes] = await db.query<any>(
        `SELECT vt.id, vt.name, vt.slug, vt.display_order
         FROM variant_types vt
         WHERE vt.is_active = TRUE
         ORDER BY vt.display_order, vt.name`
      );

      // Get all variant values
      const [allVariantValues] = await db.query<any>(
        `SELECT vtv.id, vtv.variant_type_id, vtv.value, vtv.color_code, vtv.image_url, vtv.display_order
         FROM variant_type_values vtv
         WHERE vtv.is_active = TRUE
         ORDER BY vtv.display_order, vtv.value`
      );

      // Build a set of value IDs that exist in filtered products
      const availableValueIds = new Set<number>();
      productAttrRows.forEach(par => {
        try {
          const selectedValues = typeof par.selected_values === 'string'
            ? JSON.parse(par.selected_values)
            : par.selected_values;
          if (Array.isArray(selectedValues)) {
            selectedValues.forEach((valId: number) => {
              if (valId != null && (typeof valId === 'number' || typeof valId === 'string')) {
                availableValueIds.add(Number(valId));
              }
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });

      // Build attribute map with only available values
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

        // Only add attribute if it has values in filtered products
        if (attrValues.length > 0) {
          // Check if any filtered product has this attribute type
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

      // Convert to array and sort
      const availableAttributes = Array.from(attributeMap.values())
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      // Sort attributes by display_order
      availableAttributes.sort((a, b) =>
        (a.display_order || 0) - (b.display_order || 0)
      );

      return {
        categories: rootCategories,
        attributes: availableAttributes
      };
    } catch (error) {
      console.error('Error calculating available filters:', error);
      return { categories: [], attributes: [] };
    }
  }

  /**
   * Product detail page
   */
  public static async detail(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const product = await productService.getProductBySlug(slug);

      if (!product || !product.is_active || product.status !== 'published') {
        res.status(404).render('404');
        return;
      }

      // Increment view count — fire-and-forget so it doesn't block the response
      // or hold a DB connection open while the rest of the page renders
      productService.incrementViewCount(product.id).catch(() => {});

      const productDetails = await productService.getProductWithDetails(product.id);
      if (!productDetails) {
        res.status(404).render('404');
        return;
      }

      const relatedProducts = await productService.getRelatedProducts(
        product.id,
        product.category_id,
        4
      );
      await productService.attachColorOptionsForListing(relatedProducts);
      attachMultiPriceListingFieldsForProduct(productDetails, productDetails.variants || []);

      // Get approved reviews
      const reviews = await reviewService.getProductReviews(product.id, {
        approvedOnly: true,
        limit: 10
      });

      // Get product attributes with images for visual swatches
      const productAttributeService = ProductAttributeService.getInstance();
      const productAttributes = await productAttributeService.getProductAttributes(product.id);
      const variantDisplay = buildVariantDisplayModel(
        productDetails,
        productDetails.variants || [],
        productAttributes
      );

      // SEO: product page title and meta description
      const productTitle = (productDetails as any).name || (product as any).name || slug;
      (res.locals as any).pageTitle = productTitle;
      (res.locals as any).pageDescription = (product as any).meta_description || (productDetails as any).short_description || '';
      const ogProductImage = ogImageUrlFromProduct(productDetails as any);
      if (ogProductImage) (res.locals as any).pageImage = ogProductImage;

      const variants = (productDetails as any).variants || [];
      const defaultVariant = variants.length > 0 ? variants[0] : null;
      const metaViewContent = {
        contentId: resolveFacebookCatalogContentId({
          productId: productDetails.id,
          variantId: defaultVariant?.id ?? null,
          productSku: (productDetails as any).sku,
          variantSku: defaultVariant?.sku
        }),
        value: defaultVariant?.price != null
          ? parseFloat(String(defaultVariant.price))
          : parseFloat(String((productDetails as any).price)) || 0,
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
        turnstileSiteKey: envConfig.turnstileSiteKey,
        isDevelopment: envConfig.nodeEnv !== 'production'
      });
    } catch (error) {
      console.error('Error rendering product detail page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Shopping cart page
   */
  public static async cart(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.sessionID;
      const customerId = (req.session as any).user?.id;

      let cart;
      if (customerId) {
        cart = await cartService.getOrCreateCustomerCart(customerId);
      } else {
        cart = await cartService.getOrCreateSessionCart(sessionId);
      }

      const cartTotals = await cartService.getCartTotals(cart.id);
      let discountAmount = 0;
      let appliedDiscount = null;

      // Check for applied discount
      if (cart.discount_code) {
        const cartItems = await cartService.getCartItems(cart.id);
        const productIds = cartItems.map(item => item.product_id);

        // We'll also need to get categories for implicit category validation
        // But for now let's pass productIds
        const validation = await discountService.validateDiscountCode(
          cart.discount_code,
          cartTotals.subtotal,
          customerId || null,
          productIds
        );

        if (validation.valid && validation.discountAmount) {
          discountAmount = validation.discountAmount;
          appliedDiscount = validation.discount;
        } else {
          // If valid is false but we have a code, it might be expired or invalid for these items
          // We could clear it from cart or just ignore it
          // Let's clear it if it's invalid to avoid confusion? 
          // Or keep it but show 0 discount.
          // For now, implicit behavior: if invalid, no discount amount.
        }
      }

      const totals = {
        ...cartTotals,
        shipping: 0,
        discount: discountAmount,
        total: Math.max(0, cartTotals.subtotal - discountAmount)
      };

      (res.locals as any).pageTitle = 'Cart';
      const cartOg = cart.items?.find((i: any) => i.image_url && String(i.image_url).trim())?.image_url;
      if (cartOg) (res.locals as any).pageImage = String(cartOg).trim();

      res.render('cart', {
        cart,
        totals,
        appliedDiscountCode: cart.discount_code,
        cancelled: req.query.cancelled === '1',
        metaCheckoutFailed: req.query.error === 'meta_checkout'
      });
    } catch (error) {
      console.error('Error rendering cart page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Add item to cart (API)
   */
  public static async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const { product_id, variant_id, quantity = 1 } = req.body;

      if (!product_id) {
        res.status(400).json({ success: false, error: 'Product ID is required' });
        return;
      }

      const sessionId = req.sessionID;
      const customerId = (req.session as any).user?.id;

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('Add to cart request:', { product_id, variant_id, quantity, sessionId, customerId });

      // Get product and price
      const product = await productService.getProductById(parseInt(product_id));
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const price = await productService.getProductPrice(
        product.id,
        variant_id ? parseInt(variant_id) : undefined
      );

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('Product price:', price);

      // Check stock
      const inStock = await productService.isInStock(
        product.id,
        variant_id ? parseInt(variant_id) : undefined,
        parseInt(quantity)
      );

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('In stock:', inStock);

      if (!inStock) {
        res.status(400).json({ success: false, error: 'Product is out of stock' });
        return;
      }

      // Get or create cart
      let cart;
      if (customerId) {
        cart = await cartService.getOrCreateCustomerCart(customerId);
      } else {
        cart = await cartService.getOrCreateSessionCart(sessionId);
      }

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('Cart ID:', cart.id);

      // Add item
      await cartService.addItemToCart(
        cart.id,
        product.id,
        variant_id ? parseInt(variant_id) : null,
        parseInt(quantity),
        price
      );

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('Item added to cart successfully');

      // Get updated cart totals to return new count
      const totals = await cartService.getCartTotals(cart.id);

      const contentId = await resolveFacebookCatalogContentIdFromDb(
        product.id,
        variant_id ? parseInt(variant_id) : null
      );

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
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to add item to cart' });
    }
  }

  /**
   * Update cart item (API)
   */
  public static async updateCartItem(req: Request, res: Response): Promise<void> {
    try {
      const { item_id, quantity } = req.body;

      await cartService.updateCartItemQuantity(parseInt(item_id), parseInt(quantity));

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating cart item:', error);
      res.status(500).json({ error: 'Failed to update cart item' });
    }
  }

  /**
   * Remove cart item (API)
   */
  public static async removeCartItem(req: Request, res: Response): Promise<void> {
    try {
      const { item_id } = req.body;

      await cartService.removeCartItem(parseInt(item_id));

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing cart item:', error);
      res.status(500).json({ error: 'Failed to remove cart item' });
    }
  }

  /**
   * Meta Shops checkout URL: parse products/coupon query params, replace session cart, then render checkout.
   * @see https://developers.facebook.com/documentation/ads-commerce/commerce-platform/setup-checkout-url
   */
  private static async populateCartFromMetaShopCheckout(
    cartId: number,
    productsParam: string,
    couponParam: string | undefined
  ): Promise<string[]> {
    const warnings: string[] = [];
    const lines = parseMetaShopProductsParam(productsParam);

    await cartService.clearCart(cartId);
    await cartService.setCartDiscount(cartId, null);

    if (lines.length === 0) {
      warnings.push('No valid products in checkout link.');
      return warnings;
    }

    let addedCount = 0;
    for (const line of lines) {
      const resolved = await resolveProductVariantFromCatalogContentId(line.catalogContentId);
      if (!resolved) {
        warnings.push(`Product "${line.catalogContentId}" was not found.`);
        continue;
      }

      const product = await productService.getProductById(resolved.productId);
      if (!product || !product.is_active || product.status !== 'published') {
        warnings.push(`Product "${line.catalogContentId}" is not available.`);
        continue;
      }

      const variantId = resolved.variantId ?? undefined;
      const inStock = await productService.isInStock(
        resolved.productId,
        variantId,
        line.quantity
      );
      if (!inStock) {
        warnings.push(`Product "${line.catalogContentId}" is out of stock.`);
        continue;
      }

      const price = await productService.getProductPrice(resolved.productId, variantId);
      await cartService.addItemToCart(
        cartId,
        resolved.productId,
        resolved.variantId,
        line.quantity,
        price
      );
      addedCount++;
    }

    if (addedCount === 0 && warnings.length === 0) {
      warnings.push('Could not add products from checkout link.');
    }

    const coupon = typeof couponParam === 'string' ? couponParam.trim() : '';
    if (coupon) {
      await cartService.setCartDiscount(cartId, coupon);
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

  /**
   * Checkout page (supports guest checkout via session cart)
   */
  public static async checkout(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id as number | undefined;
      const sessionId = req.sessionID;

      // Get cart (session cart for guests, customer cart for logged-in users)
      const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
      if (debugOn) console.log(`[Checkout Debug] SessionID: ${sessionId}, CustomerID: ${customerId ?? 'guest'}`);

      const cart = customerId
        ? await cartService.getOrCreateCustomerCart(customerId)
        : await cartService.getOrCreateSessionCart(sessionId);
      if (debugOn) console.log(`[Checkout Debug] Retrieved customer cart: ${cart.id}`);

      const productsParam =
        typeof req.query.products === 'string' ? req.query.products.trim() : '';
      let metaShopWarnings: string[] = [];
      if (productsParam) {
        const couponParam =
          typeof req.query.coupon === 'string' ? req.query.coupon : undefined;
        metaShopWarnings = await ShopController.populateCartFromMetaShopCheckout(
          cart.id,
          productsParam,
          couponParam
        );
        cart.discount_code =
          typeof req.query.coupon === 'string' && req.query.coupon.trim()
            ? req.query.coupon.trim()
            : null;
      }

      const cartTotals = await cartService.getCartTotals(cart.id);
      if (debugOn) console.log(`[Checkout Debug] Cart totals:`, cartTotals);

      if (cartTotals.itemCount === 0) {
        if (debugOn) console.log(`[Checkout Debug] Cart empty, redirecting to cart`);
        const err =
          productsParam && metaShopWarnings.length > 0
            ? 'meta_checkout'
            : undefined;
        res.redirect(err ? `/cart?error=${err}` : '/cart');
        return;
      }

      let discountAmount = 0;

      // Calculate discount if code exists
      if (cart.discount_code) {
        const cartItems = await cartService.getCartItems(cart.id);
        const productIds = cartItems.map(item => item.product_id);

        const validation = await discountService.validateDiscountCode(
          cart.discount_code,
          cartTotals.subtotal,
          customerId || null,
          productIds
        );

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




      // Load countries from config file (path from project root for dev and production)
      let countries: any[] = [];
      try {
        const countriesPath = getDataFilePath('countries.json');
        const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf-8'));
        countries = countriesData.countries || [];
      } catch (error) {
        console.error('Error loading countries:', error);
        // Fallback to a basic list
        countries = [
          { name: 'Lebanon', code: 'LB' },
          { name: 'United States', code: 'US' },
          { name: 'United Kingdom', code: 'GB' },
          { name: 'Canada', code: 'CA' },
          { name: 'UAE', code: 'AE' }
        ];
      }

      // Get customer address if logged in
      let customerAddress = null;
      if (customerId) {
        // Check if specific address requested
        const { addressId } = req.query;
        let query = 'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1';
        let params: any[] = [customerId];

        if (addressId) {
          query = 'SELECT * FROM customer_addresses WHERE customer_id = ? AND id = ?';
          params = [customerId, addressId];
        }

        const [addresses] = await db.query<any>(query, params);
        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          if (addr.content_encrypted && addr.iv) {
            const decryptedData = encryptionService.decrypt(addr.content_encrypted, addr.iv, { quiet: true });
            if (decryptedData) {
              customerAddress = { ...addr, ...decryptedData };
            } else {
              // Decryption failed (e.g. SESSION_SECRET changed): use plain columns so form is partially filled
              customerAddress = {
                city: addr.city,
                state: addr.state ?? '',
                postal_code: addr.postal_code ?? '',
                country: addr.country,
                first_name: '', last_name: '', address_line_1: '', address_line_2: '', phone: ''
              };
            }
          } else {
            customerAddress = addr;
          }
        } else {
          // Fallback to last order address
          const [lastOrder] = await db.query<any>(
            'SELECT shipping_address FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1',
            [customerId]
          );

          if (lastOrder && lastOrder.length > 0 && lastOrder[0].shipping_address) {
            try {
              customerAddress = typeof lastOrder[0].shipping_address === 'string'
                ? JSON.parse(lastOrder[0].shipping_address)
                : lastOrder[0].shipping_address;
            } catch (e) {
              console.error('Error parsing last order address:', e);
            }
          }
        }
      }

      // Get all active payment methods for the form; frontend shows/hides by country (Lebanon = delivery only, other = card only)
      const paymentMethods = await paymentService.getActivePaymentMethods(undefined);

      const user = customerId ? await usersService.getUserById(customerId) : null;

      (res.locals as any).pageTitle = 'Checkout';
      const cartItemsForOg = await cartService.getCartItems(cart.id);
      const checkoutOg = cartItemsForOg.find((i: any) => i.image_url && String(i.image_url).trim())?.image_url;
      if (checkoutOg) (res.locals as any).pageImage = String(checkoutOg).trim();

      const metaInitiateCheckout = {
        value: totals.total,
        currency: ShopController.metaCurrency(res),
        content_ids: await resolveFacebookCatalogContentIdsForItems(
          cartItemsForOg.map((i: any) => ({
            product_id: i.product_id,
            variant_id: i.variant_id ?? null
          }))
        )
      };

      res.render('checkout', {
        cart,
        totals,
        metaInitiateCheckout,
        metaShopWarnings: metaShopWarnings.length > 0 ? metaShopWarnings : undefined,
        shippingRates: [], // Loaded via AJAX when page opens and when address changes
        paymentMethods,
        customerId: customerId ?? undefined,
        address: customerAddress,
        user: user || undefined,
        appliedDiscountCode: cart.discount_code,
        countries
      });
    } catch (error) {
      console.error('Error rendering checkout page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Get shipping rates (API). Secure: client sends only address; server derives cart from session
   * and computes weight/totals from actual cart contents. Not forgeable.
   * GET: ?country=LB&city=Beirut&state=&postcode=
   * POST: { country, city, state?, postcode? }
   */
  public static async getShippingRates(req: Request, res: Response): Promise<void> {
    try {
      const isPost = req.method === 'POST';
      let country = (isPost ? req.body?.country : req.query?.country) ?? '';
      let city = (isPost ? req.body?.city : req.query?.city) ?? '';
      let state = (isPost ? req.body?.state : req.query?.state) ?? '';
      let postcode = (isPost ? req.body?.postcode : req.query?.postcode) ?? '';

      const sessionId = req.sessionID;
      const customerId = (req.session as any).user?.id;

      // When no address sent and user is logged in, use default saved address
      const addressEmpty = !country || !country.trim();
      if (addressEmpty && customerId) {
        const [addresses] = await db.query<any>(
          'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1',
          [customerId]
        );
        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          let resolved: any = addr;
          if (addr.content_encrypted && addr.iv) {
            const decryptedData = encryptionService.decrypt(addr.content_encrypted, addr.iv, { quiet: true });
            if (decryptedData) resolved = { ...addr, ...decryptedData };
          }
          country = resolved.country || country;
          city = (resolved.city && resolved.city.trim()) ? resolved.city.trim() : city;
          state = (resolved.state && resolved.state.trim()) ? resolved.state.trim() : state;
          postcode = (resolved.postal_code && resolved.postal_code.trim()) ? resolved.postal_code.trim() : postcode;
        }
      }

      let cart;
      if (customerId) {
        cart = await cartService.getOrCreateCustomerCart(customerId);
      } else {
        cart = await cartService.getOrCreateSessionCart(sessionId);
      }

      const cartTotals = await cartService.getCartTotals(cart.id);
      let discountAmount = 0;
      if (cart.discount_code) {
        const cartItemsForDiscount = await cartService.getCartItems(cart.id);
        const productIds = cartItemsForDiscount.map((item: any) => item.product_id);
        const validation = await discountService.validateDiscountCode(
          cart.discount_code,
          cartTotals.subtotal,
          customerId || null,
          productIds
        );
        if (validation.valid && validation.discountAmount) {
          discountAmount = validation.discountAmount;
        }
      }

      const cartItems = await cartService.getCartItems(cart.id);
      const cartSubtotal = Math.max(0, cartTotals.subtotal - discountAmount);
      const cartItemCount = cartTotals.itemCount;
      const cartTotalWeight = cartTotals.totalWeight ?? 0;
      const totalWeight = cartTotalWeight >= 0 ? cartTotalWeight : Math.max(0.5, 0);

      const hasAddress = !!(country && String(country).trim());
      let rates: any[] = [];
      if (hasAddress) {
        rates = await shippingService.getAvailableShippingRates({
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
      }

      res.json({
        success: true,
        rates: Array.isArray(rates) ? rates : [],
        cart: {
          subtotal: cartTotals.subtotal,
          itemCount: cartItemCount,
          totalWeight: totalWeight,
          discountAmount
        }
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error('Error getting shipping rates:', error);
      res.status(200).json({ success: false, error: message, rates: [], cart: null });
    }
  }

  /**
   * GET /api/shipping/cities?country=XX&state=YY&nameStartsWith=...
   * State only used when country is US. nameStartsWith optional search filter.
   * Returns { cities: [ { name, code? } ] }.
   */
  public static async getShippingCities(req: Request, res: Response): Promise<void> {
    try {
      const country = (req.query.country as string)?.trim() || '';
      const state = (req.query.state as string)?.trim() || '';
      const nameStartsWith = (req.query.nameStartsWith as string)?.trim() ?? (req.query.q as string)?.trim() ?? '';
      if (!country) {
        res.status(400).json({ success: false, error: 'country required', cities: [] });
        return;
      }
      const response = await fetchCities(country, state === '' ? undefined : state, nameStartsWith);
      if (response.HasErrors) {
        const notifs = response.Notifications?.Notification;
        const msg = Array.isArray(notifs) ? notifs.map((n) => n?.Message).filter(Boolean).join('; ') : 'Aramex error';
        res.status(200).json({ success: false, error: msg, cities: [] });
        return;
      }
      const raw = response.Cities;
      const cities: { name: string; code?: string }[] = [];
      if (raw && typeof raw === 'object') {
        if (Array.isArray((raw as any).string)) {
          (raw as any).string.forEach((name: string) => cities.push({ name: String(name) }));
        } else if (Array.isArray(raw)) {
          raw.forEach((c: any) => cities.push({ name: c?.Name || c?.name || String(c), code: c?.Code || c?.code }));
        } else {
          const arr = (raw as any).City;
          if (Array.isArray(arr)) {
            arr.forEach((c: any) => cities.push({ name: c?.Name || c?.name || String(c), code: c?.Code || c?.code }));
          }
        }
      }
      cities.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ success: true, cities });
    } catch (error: any) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch cities', cities: [] });
    }
  }

  /**
   * GET /api/shipping/states?country=US
   * Only supported for US. Returns { states: [ { name, code? } ] }.
   */
  public static async getShippingStates(req: Request, res: Response): Promise<void> {
    try {
      const country = (req.query.country as string)?.trim().toUpperCase() || '';
      if (country !== 'US' && country !== 'USA') {
        res.json({ success: true, states: [] });
        return;
      }
      const response = await fetchStates('US');
      if (response.HasErrors) {
        const notifs = response.Notifications?.Notification;
        const msg = Array.isArray(notifs) ? notifs.map((n) => n?.Message).filter(Boolean).join('; ') : 'Aramex error';
        res.status(200).json({ success: false, error: msg, states: [] });
        return;
      }
      const raw = response.States;
      const states: { name: string; code?: string }[] = [];
      if (raw && typeof raw === 'object') {
        if (Array.isArray((raw as any).string)) {
          (raw as any).string.forEach((name: string) => states.push({ name: String(name) }));
        } else if (Array.isArray(raw)) {
          raw.forEach((s: any) => states.push({ name: s?.Name || s?.name || String(s), code: s?.Code || s?.code }));
        } else {
          const arr = (raw as any).State;
          if (Array.isArray(arr)) {
            arr.forEach((s: any) => states.push({ name: s?.Name || s?.name || String(s), code: s?.Code || s?.code }));
          }
        }
      }
      states.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ success: true, states });
    } catch (error: any) {
      console.error('Error fetching states:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch states', states: [] });
    }
  }

  /**
   * Get payment methods for checkout by country (API).
   * GET: ?country=LB
   * Lebanon: Pay on delivery + Pay by card; other countries: Pay by card only.
   */
  public static async getCheckoutPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const country = (req.query?.country ?? '') as string;
      const paymentMethods = await paymentService.getActivePaymentMethods(country.trim() || undefined);
      res.json({ success: true, paymentMethods });
    } catch (error: any) {
      console.error('Error getting checkout payment methods:', error);
      res.status(500).json({ success: false, error: error?.message || 'Server error', paymentMethods: [] });
    }
  }

  /**
   * Cancel an unpaid order, restore its items to the current user's cart, and redirect to /cart.
   * Used when user cancels payment or hits back on the pay page.
   */
  private static async cancelOrderAndRestoreToCart(req: Request, res: Response, orderId: number): Promise<void> {
    const order = await orderService.getOrderById(orderId);
    if (!order || order.payment_status === 'paid') {
      res.redirect('/cart');
      return;
    }
    if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
      return;
    }
    const customerId = (req.session as any).user?.id as number | undefined;
    const sessionId = req.sessionID;
    const cart = customerId
      ? await cartService.getOrCreateCustomerCart(customerId)
      : await cartService.getOrCreateSessionCart(sessionId);
    const items = await orderService.getOrderItems(orderId);
    const cartItems = items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));
    await cartService.addOrderItemsToCart(cart.id, cartItems);
    await orderService.updateOrderStatus(orderId, 'cancelled');
    await orderService.updatePaymentStatus(orderId, 'failed');
    await orderService.addOrderNote(orderId, 'Payment cancelled by user – items restored to cart');
    res.redirect('/cart?cancelled=1');
  }

  /**
   * Checkout pay – Step 2 per bank Hosted Checkout Ver.100: our page loads bank JS and calls Checkout.showPaymentPage().
   * User lands here after Place Order (redirectUrl from Step 1). Query: sessionId, orderId.
   * If user hits back from the bank, we detect repeat visit and cancel order + restore cart → /cart.
   */
  public static async checkoutPay(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = (req.query.sessionId as string) || '';
      const orderId = parseInt((req.query.orderId as string) || '0', 10);
      if (!sessionId || !orderId) {
        res.redirect('/checkout?error=missing_session_or_order');
        return;
      }
      const order = await orderService.getOrderById(orderId);
      if (!order) {
        res.redirect('/checkout?error=order_not_found');
        return;
      }
      if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
        return;
      }
      // Already paid – e.g. user refreshed after success
      if (order.payment_status === 'paid') {
        res.redirect(`/order-success?orderNumber=${order.order_number}`);
        return;
      }
      const session = req.session as any;
      const payPageShown = session.payPageShownOrderIds && session.payPageShownOrderIds[orderId];
      if (payPageShown) {
        // User came back (browser back or cancelled on bank) – cancel order and restore cart
        delete session.payPageShownOrderIds[orderId];
        await ShopController.cancelOrderAndRestoreToCart(req, res, orderId);
        return;
      }
      session.payPageShownOrderIds = session.payPageShownOrderIds || {};
      session.payPageShownOrderIds[orderId] = true;

      const appBaseUrl = getBaseUrl(req);
      const completeUrl = `${appBaseUrl}/checkout/complete?orderId=${orderId}`;
      const cancelUrl = `${appBaseUrl}/checkout/cancel?orderId=${orderId}`;
      const gatewayUrl = envConfig.netcommerce.gatewayUrl || '';
      const gatewayScriptBaseUrl = gatewayUrl.split('/api')[0].replace(/\/$/, '');
      (res.locals as any).pageTitle = 'Payment';
      res.render('checkout-pay', {
        sessionId,
        orderId,
        completeUrl,
        cancelUrl,
        gatewayScriptBaseUrl
      });
    } catch (error: any) {
      console.error('Error rendering checkout pay page:', error);
      res.redirect('/checkout?error=pay_page_failed');
    }
  }

  /**
   * Checkout complete – return from payment gateway (Netcommerce hosted checkout).
   * Gateway redirects here with orderId (and possibly resultIndicator). We retrieve the session
   * from the gateway to confirm payment, then mark order paid and redirect to order-success.
   */
  public static async checkoutComplete(req: Request, res: Response): Promise<void> {
    try {
      // Log everything the bank sends back on return (query params and body) – e.g. receipt number, resultIndicator
      console.log('[Checkout Complete] Bank return – query:', JSON.stringify(req.query));
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('[Checkout Complete] Bank return – body:', JSON.stringify(req.body));
      }

      const orderId = parseInt((req.query.orderId as string) || '0', 10);
      if (!orderId) {
        res.redirect('/checkout?error=missing_order');
        return;
      }

      const order = await orderService.getOrderById(orderId);
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

      const transactions = await paymentService.getOrderTransactions(orderId);
      const pendingTx = transactions.find((t: any) => t.status === 'pending' && t.payment_method_code === 'netcommerce');
      if (!pendingTx || !pendingTx.gateway_response) {
        await orderService.updateOrderStatus(orderId, 'failed');
        await orderService.updatePaymentStatus(orderId, 'failed');
        await orderService.addOrderNote(orderId, 'Payment failed - Code: NO_PENDING_PAYMENT, Description: No pending payment transaction found');
        res.redirect(`/order-error?orderNumber=${order.order_number}`);
        return;
      }

      let gatewayResponse: any;
      try {
        gatewayResponse = typeof pendingTx.gateway_response === 'string'
          ? JSON.parse(pendingTx.gateway_response) : pendingTx.gateway_response;
      } catch {
        await orderService.updatePaymentStatus(orderId, 'failed');
        await orderService.addOrderNote(orderId, 'Payment failed - Code: INVALID_SESSION, Description: Invalid session data');
        res.redirect(`/order-error?orderNumber=${order.order_number}`);
        return;
      }

      const gatewayOrderId = gatewayResponse?.gatewayOrderId || gatewayResponse?.order?.id;
      const sessionId = gatewayResponse?.session?.id;
      if (!gatewayOrderId && !sessionId) {
        await orderService.updateOrderStatus(orderId, 'failed');
        await orderService.updatePaymentStatus(orderId, 'failed');
        await orderService.addOrderNote(orderId, 'Payment failed - Code: NO_SESSION, Description: No session or gateway order id in gateway response');
        res.redirect(`/order-error?orderNumber=${order.order_number}`);
        return;
      }

      // Per Hosted Checkout doc: call "Retrieve Order" and check result=SUCCESS, status=CAPTURED (or AUTHORIZED).
      const netcommerce = new NetCommerceService();
      const isMockSession = sessionId?.startsWith('mock-session-');
      let orderResult: { success: boolean; result?: string; status?: string; order?: any; error?: string } = { success: false };
      if (isMockSession && process.env.NODE_ENV === 'development') {
        orderResult = { success: true, result: 'SUCCESS', status: 'CAPTURED' };
        console.log('[Checkout Complete] Mock session – orderId:', orderId, 'orderResult:', JSON.stringify(orderResult));
      } else if (gatewayOrderId) {
        orderResult = await netcommerce.retrieveOrder(gatewayOrderId);
        console.log('[Checkout Complete] Retrieve Order – orderId:', orderId, 'gatewayOrderId:', gatewayOrderId, 'orderResult:', JSON.stringify(orderResult));
      } else if (sessionId) {
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
        await orderService.updateOrderStatus(orderId, 'failed');
        await orderService.updatePaymentStatus(orderId, 'failed');
        await orderService.addOrderNote(orderId, `Payment failed - Code: ${errorCode}, Description: ${errorDesc}`);
        res.redirect(`/order-error?orderNumber=${order.order_number}`);
        return;
      }

      // Update order payment status to paid and set status back from verifying to pending
      await orderService.updatePaymentStatus(orderId, 'paid');
      if (order.status === 'verifying') {
        await orderService.updateOrderStatus(orderId, 'pending');
      }

      // Persist bank return + Retrieve Order result on transaction (receipt number, etc.) and mark completed
      const completionPayload = {
        bankReturnQuery: req.query,
        bankReturnBody: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
        retrievedOrder: orderResult
      };
      const updatedGatewayResponse = { ...gatewayResponse, completion: completionPayload };
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, processed_at = NOW(), updated_at = NOW() WHERE id = ?`,
        ['completed', JSON.stringify(updatedGatewayResponse), pendingTx.id]
      );

      // Send order confirmation emails (same as processCheckout for non-redirect)
      try {
        const orderItems = await orderService.getOrderItems(orderId);
        const shippingAddress = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address) : order.shipping_address;
        const emailItems = orderItems.map((item: any) => ({
          name: item.variant_name ? `${item.product_name || 'Product'} (${item.variant_name})` : (item.product_name || 'Product'),
          quantity: item.quantity,
          price: Number(item.unit_price)
        }));
        const settingsService = EcommerceSettingsService.getInstance();
        const settings = await settingsService.getSettings();
        const storeEmail = settings.store_email || process.env.SMTP_FROM || 'admin@example.com';

        const num = (v: unknown) => Number(v) || 0;
        await emailService.sendOrderConfirmation(
          order.order_number,
          order.customer_email,
          shippingAddress?.first_name && shippingAddress?.last_name
            ? `${shippingAddress.first_name} ${shippingAddress.last_name}` : 'Customer',
          {
            items: emailItems,
            subtotal: num(order.subtotal),
            tax: num(order.tax_amount),
            shipping: num(order.shipping_amount),
            discount: num(order.discount_amount),
            total: num(order.total_amount),
            shippingAddress: shippingAddress || {}
          }
        );
        await emailService.sendNewOrderNotification(
          storeEmail,
          order.order_number,
          shippingAddress?.first_name && shippingAddress?.last_name
            ? `${shippingAddress.first_name} ${shippingAddress.last_name}` : 'Customer',
          order.customer_email,
          {
            items: emailItems,
            total: num(order.total_amount),
            subtotal: num(order.subtotal),
            shipping: num(order.shipping_amount),
            shippingAddress: shippingAddress || {}
          }
        );
      } catch (emailError) {
        console.error('Error sending order confirmation after payment:', emailError);
      }

      res.redirect(`/order-success?orderNumber=${order.order_number}`);
    } catch (error: any) {
      console.error('Error in checkout complete:', error);
      const orderId = parseInt((req.query.orderId as string) || '0', 10);
      if (orderId) {
        try {
          const order = await orderService.getOrderById(orderId);
          if (order) {
            const errMsg = error?.message || String(error);
            await orderService.updateOrderStatus(orderId, 'failed');
            await orderService.updatePaymentStatus(orderId, 'failed');
            await orderService.addOrderNote(orderId, `Payment failed - Code: CALLBACK_ERROR, Description: ${errMsg}`);
            res.redirect(`/order-error?orderNumber=${order.order_number}`);
            return;
          }
        } catch (logErr) {
          console.error('Error logging payment failure:', logErr);
        }
      }
      res.redirect('/checkout?error=payment_callback_failed');
    }
  }

  /**
   * Checkout cancel – user cancelled payment on gateway. Cancel order, restore items to cart, redirect to /cart.
   */
  public static async checkoutCancel(req: Request, res: Response): Promise<void> {
    const orderIdRaw = req.query.orderId as string;
    const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : 0;
    if (orderId && !isNaN(orderId)) {
      await ShopController.cancelOrderAndRestoreToCart(req, res, orderId);
    } else {
      res.redirect('/cart?cancelled=1');
    }
  }

  /**
   * Order success page
   */
  public static async orderSuccess(req: Request, res: Response): Promise<void> {
    try {
      const { orderNumber } = req.query;

      if (!orderNumber) {
        res.redirect('/shop');
        return;
      }

      let order = await orderService.getOrderByNumber(orderNumber as string);
      if (!order) {
        res.redirect('/shop?error=order_not_found');
        return;
      }
      // If logged in and this is a guest order with matching email, attach it to the account so it appears in My Orders
      const customerId = (req.session as any).user?.id as number | undefined;
      const sessionEmail = (req.session as any).user?.email as string | undefined;
      if (customerId != null && sessionEmail && order.customer_id == null &&
          order.customer_email.trim().toLowerCase() === sessionEmail.trim().toLowerCase()) {
        await orderService.attachGuestOrdersToCustomer(customerId, sessionEmail);
        order = (await orderService.getOrderByNumber(orderNumber as string))!;
      }
      if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
        return;
      }

      const orderWithItems = await orderService.getOrderWithItems(order.id);
      const orderItems = orderWithItems?.items || [];
      const metaPurchase = orderWithItems
        ? {
            value: orderWithItems.total_amount,
            currency: orderWithItems.currency || ShopController.metaCurrency(res),
            content_ids: await resolveFacebookCatalogContentIdsForItems(
              orderItems.map((i) => ({
                product_id: i.product_id,
                variant_id: i.variant_id ?? null
              }))
            )
          }
        : undefined;

      (res.locals as any).pageTitle = 'Order Confirmed';
      res.render('order-success', {
        orderNumber: order.order_number,
        metaPurchase
      });
    } catch (error) {
      console.error('Error rendering order success page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Order error page – payment could not be completed (generic message; details logged in order notes).
   */
  public static async orderError(req: Request, res: Response): Promise<void> {
    try {
      const { orderNumber } = req.query;

      if (!orderNumber) {
        res.redirect('/checkout?error=missing_order');
        return;
      }

      const order = await orderService.getOrderByNumber(orderNumber as string);
      if (!order) {
        res.redirect('/shop?error=order_not_found');
        return;
      }
      if (!(await ShopController.ensureOrderBelongsToUser(req, res, order))) {
        return;
      }

      (res.locals as any).pageTitle = 'Order Error';
      res.render('order-error', {
        orderNumber: order.order_number
      });
    } catch (error) {
      console.error('Error rendering order error page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Process checkout (API)
   */
  public static async processCheckout(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.sessionID;
      const customerId = (req.session as any).user?.id;
      const {
        shipping_address,
        billing_address,
        shipping_method_id,
        payment_method_id,
        discount_code,
        selected_shipping_cost: frontendShippingCost
      } = req.body;

      // Validate required fields early to avoid crashes and return clear errors
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

      // Get cart
      let cart;
      if (customerId) {
        cart = await cartService.getOrCreateCustomerCart(customerId);
      } else {
        cart = await cartService.getOrCreateSessionCart(sessionId);
      }

      const cartItems = await cartService.getCartItems(cart.id);
      const cartTotals = await cartService.getCartTotals(cart.id);

      if (cartItems.length === 0) {
        res.status(400).json({ error: 'Cart is empty' });
        return;
      }

      // Calculate discount first (might affect shipping)
      let discountAmount = 0;
      let discountId: number | null = null;
      let finalDiscountCode = discount_code;

      if (!finalDiscountCode && cart.discount_code) {
        finalDiscountCode = cart.discount_code;
      }

      if (finalDiscountCode) {
        const productIds = cartItems.map(item => item.product_id);
        const validation = await discountService.validateDiscountCode(
          finalDiscountCode,
          cartTotals.subtotal,
          customerId || null,
          productIds
        );
        if (validation.valid && validation.discountAmount) {
          discountAmount = validation.discountAmount;
          discountId = validation.discount!.id;
        }
      }

      const totalBeforeShipping = Math.max(0, cartTotals.subtotal - discountAmount);

      // Calculate shipping (DB rates via getShippingRateById; synthetic rates e.g. Aramex 9999 via getAvailableShippingRates)
      let shippingAmount = 0;
      if (shipping_method_id) {
        const rateId = parseInt(shipping_method_id, 10);
        const shippingRate = await shippingService.getShippingRateById(rateId);
        if (shippingRate) {
          const addressLine = shipping_address.address ?? shipping_address.address_line1 ?? '';
          shippingAmount = await shippingService.calculateShippingCost(
            shippingRate.id,
            {
              subtotal: cartTotals.subtotal,
              totalPrice: totalBeforeShipping,
              itemCount: cartTotals.itemCount,
              totalWeight: cartTotals.totalWeight || 0,
              country: shipping_address.country || 'LB',
              city: shipping_address.city,
              address: addressLine,
              items: cartItems
            }
          );
        } else {
          // Synthetic rate (e.g. Aramex id 9999) – not in shipping_rates table; get cost from same API as checkout page
          const availableRates = await shippingService.getAvailableShippingRates({
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
          const match = Array.isArray(availableRates) ? availableRates.find((r: any) => r.rate && Number(r.rate.id) === rateId) : null;
          if (match != null && typeof match.cost === 'number') {
            shippingAmount = match.cost;
          } else {
            // Fallback: use cost sent from frontend (what user saw at checkout) when backend couldn't resolve synthetic rate
            const sentCost = Number(frontendShippingCost);
            if (!isNaN(sentCost) && sentCost >= 0 && sentCost <= 10000) {
              shippingAmount = sentCost;
            }
          }
        }
      }

      // Calculate totals
      const taxAmount = 0; // Calculate tax based on settings
      const finalTotal = Math.max(0, cartTotals.subtotal + shippingAmount + taxAmount - discountAmount);

      // Create order
      // Get payment method details and ensure it is allowed for the shipping country (Lebanon = delivery only, other = card only)
      const paymentMethod = await paymentService.getPaymentMethodById(parseInt(payment_method_id));
      const countryCode = shipping_address.country ? String(shipping_address.country).trim() : '';
      const allowedMethods = await paymentService.getActivePaymentMethods(countryCode || undefined);
      const allowedIds = allowedMethods.map((m: { id: number }) => m.id);
      if (!paymentMethod || !allowedIds.includes(paymentMethod.id)) {
        res.status(400).json({
          success: false,
          error: 'The selected payment method is not available for this country. Lebanon: Pay on delivery only. Other countries: Pay by card only.'
        });
        return;
      }

      const orderData: {
        customer_id: number | null;
        customer_email: string;
        customer_phone?: string | undefined;
        shipping_address: any;
        billing_address: any;
        items: Array<{ product_id: number; variant_id: number | null; quantity: number; unit_price: number }>;
        subtotal: number;
        tax_amount: number;
        shipping_amount: number;
        discount_amount: number;
        total_amount: number;
        payment_method: string;
        shipping_method?: string | undefined;
        discount_code?: string | undefined;
        currency?: string;
        notes?: string | undefined;
      } = {
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

      const order = await orderService.createOrder(orderData);

      // Record discount usage
      if (discountId && discountAmount > 0) {
        await discountService.recordDiscountUsage(
          discountId,
          order.id,
          customerId || null,
          discountAmount
        );
      }

      // Base URL for payment return/cancel (hosted checkout)
      const appBaseUrl = getBaseUrl(req);

      // Process payment (customerName + billingAddress align with Mastercard sample payload)
      const billingForGateway = billing_address || shipping_address;
      const customerNameForGateway = [billingForGateway?.first_name, billingForGateway?.last_name].filter(Boolean).join(' ') || undefined;
      const paymentData: Parameters<typeof paymentService.processPayment>[0] = {
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
      if (typeof customerNameForGateway === 'string') paymentData.customerName = customerNameForGateway;
      if (shipping_address.phone) paymentData.customerPhone = shipping_address.phone;
      const paymentResult = await paymentService.processPayment(paymentData);

      // Handle successful process or redirection
      if (paymentResult.success) {
        // Clear cart
        await cartService.clearCart(cart.id);
        await cartService.setCartDiscount(cart.id, null);
        // Before sending to bank: set order status to verifying (credit card hosted checkout)
        if (paymentResult.redirectUrl) {
          await orderService.updateOrderStatus(order.id, 'verifying');
        }
      } else {
        res.json({ success: false, error: paymentResult.error });
        return;
      }

      // Send emails only when payment is complete (no redirect). For hosted checkout, emails are sent in checkoutComplete.
      if (!paymentResult.redirectUrl) {
        (async () => {
          try {
            const orderItems = await orderService.getOrderItems(order.id);
            const emailItems = orderItems.map(item => ({
              name: item.variant_name ? `${item.product_name || 'Product'} (${item.variant_name})` : (item.product_name || 'Product'),
              quantity: item.quantity,
              price: Number(item.unit_price)
            }));

            const settingsService = EcommerceSettingsService.getInstance();
            const settings = await settingsService.getSettings();
            const storeEmail = settings.store_email || process.env.SMTP_FROM || 'admin@example.com';

            await emailService.sendOrderConfirmation(
              order.order_number,
              shipping_address.email,
              `${shipping_address.first_name} ${shipping_address.last_name}`,
              {
                items: emailItems,
                subtotal: cartTotals.subtotal,
                tax: taxAmount,
                shipping: shippingAmount,
                discount: discountAmount,
                total: finalTotal,
                shippingAddress: shipping_address
              }
            );

            await emailService.sendNewOrderNotification(
              storeEmail,
              order.order_number,
              `${shipping_address.first_name} ${shipping_address.last_name}`,
              shipping_address.email,
              {
                items: emailItems,
                total: finalTotal,
                subtotal: cartTotals.subtotal,
                shipping: shippingAmount,
                shippingAddress: shipping_address
              }
            );
          } catch (emailError) {
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
    } catch (error: any) {
      console.error('Error processing checkout:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process checkout'
      });
    }
  }

  /**
   * Validate discount code (API)
   */
  public static async validateDiscount(req: Request, res: Response): Promise<void> {
    try {
      const { code, subtotal } = req.body;
      const customerId = (req.session as any).user?.id;
      const sessionId = req.sessionID;

      // Get cart to get items for validation
      let cart;
      if (customerId) {
        cart = await cartService.getOrCreateCustomerCart(customerId);
      } else {
        cart = await cartService.getOrCreateSessionCart(sessionId);
      }

      const cartItems = await cartService.getCartItems(cart.id);
      const productIds = cartItems.map(item => item.product_id);

      const validation = await discountService.validateDiscountCode(
        code,
        parseFloat(subtotal),
        customerId || null,
        productIds
      );

      if (validation.valid) {
        // Save discount code to cart
        await cartService.setCartDiscount(cart.id, code);
      }

      res.json(validation);
    } catch (error) {
      console.error('Error validating discount:', error);
      res.status(500).json({ error: 'Failed to validate discount code' });
    }
  }

  /**
   * Submit product review (API)
   */
  public static async submitReview(req: Request, res: Response): Promise<void> {

    try {
      const { product_id, rating, review_text, reviewer_name, reviewer_email, title, cf_turnstile_response } = req.body;
      const customerId = (req.session as any).user?.id;

      if (envConfig.turnstileSecretKey && !cf_turnstile_response) {
        res.status(400).json({ error: 'Please complete the security verification' });
        return;
      }
      if (envConfig.turnstileSecretKey && cf_turnstile_response) {
        const valid = await verifyTurnstileToken(cf_turnstile_response, req.ip || req.socket?.remoteAddress);
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

      const review = await reviewService.submitReview(parseInt(product_id), {
        customer_id: customerId || null,
        reviewer_name,
        reviewer_email: reviewer_email || null,
        rating: parseInt(rating),
        title: title || null,
        review_text
      });

      res.json({ success: true, review, message: 'Review submitted successfully. It will be published after approval.' });
    } catch (error) {
      console.error('Error submitting review:', error);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  }

  /**
   * Get product reviews (API)
   */
  public static async getReviews(req: Request, res: Response): Promise<void> {
    try {
      const { product_id } = req.params;
      const { limit, offset } = req.query;

      const reviewOptions: {
        approvedOnly?: boolean;
        limit?: number;
        offset?: number;
      } = {
        approvedOnly: true
      };
      if (limit) reviewOptions.limit = parseInt(limit as string);
      if (offset) reviewOptions.offset = parseInt(offset as string);

      const reviews = await reviewService.getProductReviews(parseInt(product_id), reviewOptions);

      res.json({ success: true, reviews });
    } catch (error) {
      console.error('Error getting reviews:', error);
      res.status(500).json({ error: 'Failed to get reviews' });
    }
  }

  /**
   * Get product details (API)
   */
  public static async getProductDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await productService.getProductWithDetails(parseInt(id));

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      // Get product attributes with images for visual swatches
      const productAttributeService = ProductAttributeService.getInstance();
      const productAttributes = await productAttributeService.getProductAttributes(product.id);
      const variantDisplay = buildVariantDisplayModel(product, product.variants || [], productAttributes);

      res.json({
        success: true,
        product,
        productAttributes,
        variantDisplay
      });
    } catch (error) {
      console.error('Error getting product details API:', error);
      res.status(500).json({ success: false, error: 'Failed to get product details' });
    }
  }
}
