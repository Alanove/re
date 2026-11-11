/**
 * Middleware Service
 * 
 * Handles general application middleware setup
 */

import { Express, Request, Response, NextFunction } from 'express';
import pagesService from './pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { categoryListingImageUrl, formatMoneyAmount, formatTrademarks } from '../utils/viewHelpers';
import { envConfig } from '../config/env.config';

export class MiddlewareService {
  private static instance: MiddlewareService;
  private siteSettingsService: SiteSettingsService;

  // Short-lived in-memory caches to avoid hitting the DB on every request
  private categoryCache: { data: any[] | null; expires: number } = { data: null, expires: 0 };
  private featuredCache: { data: any[] | null; expires: number } = { data: null, expires: 0 };
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

  private constructor() {
    this.siteSettingsService = SiteSettingsService.getInstance();
  }

  public static getInstance(): MiddlewareService {
    if (!MiddlewareService.instance) {
      MiddlewareService.instance = new MiddlewareService();
    }
    return MiddlewareService.instance;
  }

  /**
   * Configure general application middleware
   * Sets up pages, SEO data, site settings, and body classes
   */
  public configureGeneralMiddleware(app: Express): void {
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Ensure menu cache is loaded
        await pagesService.initialize();
        
        const pageKey = pagesService.getPageKeyFromPath(req.path);
        const seoData = pagesService.getSeoData(pageKey, {
          pageUrl: `${pagesService.getSiteData().domain}${req.path}`
        });

        (res.locals as any).isHomePage = req.path === '/';
        (res.locals as any).assetVersion = envConfig.assetVersion;
        (res.locals as any).isProduction = envConfig.nodeEnv === 'production';

        (res.locals as any).items = pagesService.getMenuItems();
        (res.locals as any).menus = {
          main: pagesService.getMenu('Main Menu'),
          footer: pagesService.getMenu('Footer Menu'),
          account: pagesService.getMenu('Account Menu')
        };
        (res.locals as any).selected = pageKey;
        (res.locals as any).siteData = pagesService.getSiteData();
        

        // Load site settings for footer and other components
        try {
          (res.locals as any).siteSettings = await this.siteSettingsService.getAllSettings();
          // Expose siteImage globally for product placeholders
          (res.locals as any).siteImage = (res.locals as any).siteSettings.siteImage || '/MultiShop/img/product-1.jpg';
        } catch (error) {
          console.error('Error loading site settings:', error);
          (res.locals as any).siteSettings = {};
          (res.locals as any).siteImage = '/MultiShop/img/product-1.jpg';
        }

        // E-commerce settings: always load fresh (no short cache) so admin changes to
        // multi_price_display, currency, etc. apply immediately.
        try {
          const { EcommerceSettingsService } = await import('../../admin/services/ecommerceSettingsService');
          const s = await EcommerceSettingsService.getInstance().getSettings();
          (res.locals as any).ecommerceSettings = s || {};
        } catch (error) {
          console.error('Error loading e-commerce settings:', error);
          (res.locals as any).ecommerceSettings = {};
        }

        // Load categories for mega menu (cached for 60s to avoid per-request DB query)
        try {
          if (Date.now() >= this.categoryCache.expires) {
            const categoryService = (await import('./categoryService')).default;
            const allCategories = await categoryService.getAllCategories();
            this.categoryCache = {
              data: allCategories.filter((c: any) => c.parent_id === null && c.is_active),
              expires: Date.now() + this.CACHE_TTL_MS,
            };
          }
          (res.locals as any).categories = this.categoryCache.data ?? [];
        } catch (error) {
           console.error('Error loading categories:', error);
           (res.locals as any).categories = [];
        }

        // Load featured products pool for mega menu (cached for 60s)
        try {
          if (Date.now() >= this.featuredCache.expires) {
            const productService = (await import('./productService')).default;
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
            (res.locals as any).randomFeaturedProduct = pool[randomIndex];
          } else {
            (res.locals as any).randomFeaturedProduct = null;
          }
        } catch (error) {
           console.error('Error loading featured product for menu:', error);
           (res.locals as any).randomFeaturedProduct = null;
        }
        
        // Set SEO data
        (res.locals as any).pageTitle = seoData.pageTitle;
        (res.locals as any).pageDescription = seoData.pageDescription;
        (res.locals as any).pageKeywords = seoData.pageKeywords;
        (res.locals as any).pageUrl = seoData.pageUrl;
        (res.locals as any).pageImage = seoData.pageImage;
        (res.locals as any).pageType = seoData.pageType;
        (res.locals as any).pageRobots = seoData.pageRobots;

        // View helpers for templates (e.g. format ® as <sup>&reg;</sup>)
        (res.locals as any).formatTrademarks = formatTrademarks;
        (res.locals as any).formatMoneyAmount = formatMoneyAmount;
        (res.locals as any).categoryListingImageUrl = categoryListingImageUrl;

        // Pass user data from session to templates (for public site)
        if (req.session && (req.session as any).user) {
          (res.locals as any).user = (req.session as any).user;
        } else {
          (res.locals as any).user = null;
        }

        // Load cart count for header badge
        // For logged-in users: get or create their cart as before.
        // For anonymous users: SELECT only — never INSERT here; a cart row is
        // created only when the user actually adds an item. This prevents
        // thousands of bot/crawler requests from flooding shopping_carts.
        try {
          const cartService = (await import('./cartService')).default;
          const dbInstance = (await import('../config/database')).default;
          const userId = req.session && (req.session as any).user ? (req.session as any).user.id : null;
          const sessionId = req.sessionID;

          if (userId) {
            const cart = await cartService.getOrCreateCustomerCart(userId);
            const cartItems = await cartService.getCartItems(cart.id);
            (res.locals as any).cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
          } else {
            const [cartRows] = await dbInstance.query<any[]>(
              'SELECT id FROM shopping_carts WHERE session_id = ? LIMIT 1',
              [sessionId]
            );
            if (cartRows.length > 0) {
              const cartItems = await cartService.getCartItems((cartRows[0] as any).id);
              (res.locals as any).cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
            } else {
              (res.locals as any).cartCount = 0;
            }
          }
        } catch (error) {
          console.error('Error loading cart count:', error);
          (res.locals as any).cartCount = 0;
        }

        try {
          const db = (await import('../config/database')).default;
          const userId = req.session && (req.session as any).user ? (req.session as any).user.id : null;
          const sessionId = req.sessionID;
          
          let wishlistCount = 0;
          if (userId) {
            const [rows] = await db.query<any[]>(
              'SELECT COUNT(*) as count FROM wishlists WHERE customer_id = ?',
              [userId]
            );
            wishlistCount = rows && rows.length > 0 && (rows[0] as any).count ? (rows[0] as any).count : 0;
          } else if (sessionId) {
            const [rows] = await db.query<any[]>(
              'SELECT COUNT(*) as count FROM wishlists WHERE session_id = ? AND customer_id IS NULL',
              [sessionId]
            );
            wishlistCount = rows && rows.length > 0 && (rows[0] as any).count ? (rows[0] as any).count : 0;
          }
          (res.locals as any).wishlistCount = wishlistCount;
        } catch (error) {
          console.error('Error loading wishlist count:', error);
          (res.locals as any).wishlistCount = 0;
        }
        
        // Add current path as body class
        let bodyClass = req.path === '/' ? 'home' : req.path.slice(1).replace(/\//g, '-');
        
        // All project-related pages should have 'projects' class
        if (req.path.startsWith('/projects')) {
          bodyClass = 'projects';
        }
        
        // Add inner-page class for pages that use the inner page template
        if (req.path !== '/' && !req.path.startsWith('/admin') && !req.path.startsWith('/projects') && !req.path.startsWith('/novosti')) {
          bodyClass += ' inner-page';
        }
        
        (res.locals as any).bodyClass = bodyClass;
        
        next();
      } catch (error) {
        console.error('Error in middleware:', error);
        next();
      }
    });
  }
}

export const middlewareService = MiddlewareService.getInstance();
export default middlewareService;
