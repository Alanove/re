/**
 * Routes Module
 * 
 * Centralized route definitions for the application
 */

import { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import pagesService from '../services/pagesService';
import { showProjects, showProjectDetail } from '../controllers/projectsController';
import { HomeController } from '../controllers/homeController';
import { NewsController } from '../controllers/newsController';
import { ShopController } from '../controllers/shopController';
import { FacebookProductFeedController } from '../controllers/facebookProductFeedController';
import { CustomerController } from '../controllers/customerController';
import { AuthController } from '../controllers/authController';
import { PagesService as AdminPagesService } from '../../admin/services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { AdminMenuService } from '../../admin/services/adminMenuService';
import { usersService } from '../../admin/services/usersService';
import { i18nService, SupportedLanguage } from '../../admin/services/i18nService';
import { themeService } from '../../admin/services/themeService';
import { envConfig } from '../config/env.config';
import { DATA_PATHS } from '../constants/data-paths';
import adminRoutes from '../../admin/routes/index';

const adminPagesService = AdminPagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

const sponsorshipUploadDir = path.join(DATA_PATHS.PUBLIC_DIR, 'uploads', 'sponsorship');
if (!fs.existsSync(sponsorshipUploadDir)) {
  fs.mkdirSync(sponsorshipUploadDir, { recursive: true });
}
const sponsorshipUpload = multer({
  storage: multer.diskStorage({
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

/**
 * Configure all application routes
 */
export function configureRoutes(app: Express): void {
  // Home route
  app.get('/', HomeController.index);

  // Events route
  app.get('/events', HomeController.events);

  // Global middleware to set user for views
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.session && (req.session as any).user) {
        (res.locals as any).user = (req.session as any).user;
      } else {
        (res.locals as any).user = null;
      }
      
      // Also handle language here for public site if not already handled
      if (!(res.locals as any).t) {
         let currentLanguage: SupportedLanguage = 'en';
         if (req.session && (req.session as any).language) {
          currentLanguage = (req.session as any).language;
         }
         (res.locals as any).currentLanguage = currentLanguage;
         (res.locals as any).t = (key: string, params?: Record<string, string | number>) => {
            return i18nService.translate(key, currentLanguage, params);
         };
         (res.locals as any).htmlDir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
         (res.locals as any).htmlLang = currentLanguage;
      }

      // Newsletter flash (show once then clear)
      if (req.session && (req.session as any).newsletterSuccess) {
        (res.locals as any).newsletterSuccess = (req.session as any).newsletterSuccess;
        (req.session as any).newsletterSuccess = null;
      } else {
        (res.locals as any).newsletterSuccess = null;
      }
      if (req.session && (req.session as any).newsletterError) {
        (res.locals as any).newsletterError = (req.session as any).newsletterError;
        (req.session as any).newsletterError = null;
      } else {
        (res.locals as any).newsletterError = null;
      }
      
      next();
    } catch (error) {
      console.error('Error in global middleware:', error);
      next();
    }
  });

  // About page - read from database
  app.get('/about', (_req: Request, res: Response) => {
    const pageData = pagesService.getPageData('about');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).backgroundImage = pageData.backgroundImage || '';
      (res.locals as any).pageTitle = pageData.title || 'About';
      (res.locals as any).pageDescription = pageData.seo?.pageDescription || '';
    } else {
      (res.locals as any).pageTitle = 'About';
    }
    res.render('about');
  });

  // Services page - read from database
  app.get('/services', (_req: Request, res: Response) => {
    const pageData = pagesService.getPageData('services');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).backgroundImage = pageData.backgroundImage || '';
      (res.locals as any).pageTitle = pageData.title || 'Services';
      (res.locals as any).pageDescription = pageData.seo?.pageDescription || '';
    } else {
      (res.locals as any).pageTitle = 'Services';
    }
    res.render('services');
  });

  // Projects routes
  app.get('/projects', showProjects);
  app.get('/projects/categories/:category', showProjects);
  app.get('/projects/countries/:country', showProjects);
  app.get('/projects/:projectUrl', showProjectDetail);

  // News routes
  app.get('/novosti', NewsController.list);
  app.get('/novosti/year/:year', NewsController.listByYear);
  app.get('/novosti/month/:date', NewsController.listByMonth);
  app.get('/novosti/day/:date', NewsController.listByDay);
  app.get('/novosti/tag/:tagSlug', NewsController.listByTag);
  app.get('/novosti/:slug', NewsController.article);

  // Videos route (video tag)
  app.get('/video', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;

      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'video'
      });

      const totalPages = Math.ceil(result.total / itemsPerPage);
      (res.locals as any).selected = 'video';

      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        pageTitle: 'Видео'
      });
    } catch (error) {
      console.error('Error rendering videos listing:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Individual video route (video tag)
  app.get('/video/:slug', async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;

      // Get video by slug
      const article = await adminPagesService.getPageBySlug(slug);

      if (!article || article.status !== 'published') {
        return res.status(404).render('404');
      }

      // Check if article has video tag
      const hasVideoTag = article.tags && article.tags.some((tag: any) => tag.slug === 'video');

      if (!hasVideoTag) {
        // If it doesn't have video tag, render as 404
        return res.status(404).render('404');
      }

      // Get related videos (other video articles)
      const relatedResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 4,
        status: 'published',
        tag: 'video'
      });

      // Filter out current video from related and take 3
      const relatedArticles = relatedResult.pages.filter((a: any) => a.id !== article.id).slice(0, 3);

      // Load gallery photos for this video
      const pagePhotos = await adminPagesService.getPagePhotos(article.id);

      // Set selected state for menu highlighting (use video slug)
      (res.locals as any).selected = `video-${article.slug}`;
      (res.locals as any).pageTitle = article.title;
      (res.locals as any).pageImage = article.pageImage || '';
      (res.locals as any).pageDescription = article.metaDescription || article.description || '';

      res.render('news/article', {
        article: article,
        relatedArticles: relatedArticles,
        pagePhotos: pagePhotos || []
      });
    } catch (error) {
      console.error('Error rendering video article:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Announcements route (objav tag)
  app.get('/objav', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;

      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'objav'
      });

      const totalPages = Math.ceil(result.total / itemsPerPage);
      (res.locals as any).selected = 'objav';

      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        pageTitle: 'Объявления'
      });
    } catch (error) {
      console.error('Error rendering announcements listing:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Individual announcement article route (objav tag)
  app.get('/objav/:slug', async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;

      // Get article by slug
      const article = await adminPagesService.getPageBySlug(slug);

      if (!article || article.status !== 'published') {
        return res.status(404).render('404');
      }

      // Check if article has objav tag
      const hasObjavTag = article.tags && article.tags.some((tag: any) => tag.slug === 'objav');

      if (!hasObjavTag) {
        // If it doesn't have objav tag, render as 404
        return res.status(404).render('404');
      }

      // Get related articles (other objav articles)
      const relatedResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 4,
        status: 'published',
        tag: 'objav'
      });

      // Filter out current article from related and take 3
      const relatedArticles = relatedResult.pages.filter((a: any) => a.id !== article.id).slice(0, 3);

      // Load gallery photos for this article
      const pagePhotos = await adminPagesService.getPagePhotos(article.id);

      // Set selected state for menu highlighting (use article slug)
      (res.locals as any).selected = `objav-${article.slug}`;
      (res.locals as any).pageTitle = article.title;
      (res.locals as any).pageImage = article.pageImage || '';
      (res.locals as any).pageDescription = article.metaDescription || article.description || '';

      res.render('news/article', {
        article: article,
        relatedArticles: relatedArticles,
        pagePhotos: pagePhotos || []
      });
    } catch (error) {
      console.error('Error rendering announcement article:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Projects Info page
  app.get('/projects-info', (_req: Request, res: Response) => {
    const pageData = pagesService.getPageData('projects-info');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).pageTitle = pageData.title || 'Projects Info';
      (res.locals as any).pageDescription = pageData.seo?.pageDescription || '';
    } else {
      (res.locals as any).pageTitle = 'Projects Info';
    }
    res.render('projects-info');
  });

  // About Compound page
  app.get('/about-compound', (_req: Request, res: Response) => {
    const pageData = pagesService.getPageData('about-compound');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).pageTitle = pageData.title || 'About Compound';
      (res.locals as any).pageDescription = pageData.seo?.pageDescription || '';
    } else {
      (res.locals as any).pageTitle = 'About Compound';
    }
    res.render('about-compound');
  });

  // Contact page - Turnstile always shown (use Cloudflare test key in dev when env not set)
  const contactTurnstileSiteKey = envConfig.turnstileSiteKey ?? (envConfig.nodeEnv !== 'production' ? '1x00000000000000000000AA' : undefined);
  app.get('/contact-us', async (req: Request, res: Response) => {
    try {
      const siteSettings = await siteSettingsService.getAllSettings();
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      
      // Get data from session if available (PRG pattern)
      const successMessage = (req.session as any).contactSuccess;
      const errorMessage = (req.session as any).contactError;
      const formData = (req.session as any).contactForm || {};

      // Clear session data
      (req.session as any).contactSuccess = null;
      (req.session as any).contactError = null;
      (req.session as any).contactForm = null;

      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log('Rendering contact page with PRG pattern');
      (res.locals as any).layout = 'layout'; // Force layout via locals
      (res.locals as any).pageTitle = 'Contact Us';
      (res.locals as any).pageDescription = (siteSettings as any).siteDescription || '';

      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettings,
        successMessage: successMessage,
        errorMessage: errorMessage,
        formData: formData,
        turnstileSiteKey: contactTurnstileSiteKey,
        layout: 'layout' // keep it here too just in case
      });
    } catch (error) {
      console.error('Error loading contact page:', error);
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      (res.locals as any).pageTitle = 'Contact Us';
      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: {},
        turnstileSiteKey: contactTurnstileSiteKey
      });
    }
  });

  app.get('/sponsorship/event', async (req: Request, res: Response) => {
    try {
      const siteSettings = await siteSettingsService.getAllSettings();
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      const successMessage = (req.session as any).sponsorshipEventSuccess;
      const errorMessage = (req.session as any).sponsorshipEventError;
      const formData = (req.session as any).sponsorshipEventFormData || {};
      (req.session as any).sponsorshipEventSuccess = null;
      (req.session as any).sponsorshipEventError = null;
      (req.session as any).sponsorshipEventFormData = null;
      (res.locals as any).layout = 'layout';
      (res.locals as any).pageTitle = 'Sponsorship Form for Events';
      res.render('sponsorship-event', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettings,
        successMessage,
        errorMessage,
        formData
      });
    } catch (error) {
      console.error('Error loading sponsorship event page:', error);
      (res.locals as any).pageTitle = 'Sponsorship Form for Events';
      res.render('sponsorship-event', {
        siteData: pagesService.getSiteData(),
        siteSettings: {},
        formData: {}
      });
    }
  });

  app.get('/sponsorship/athlete', async (req: Request, res: Response) => {
    try {
      const siteSettings = await siteSettingsService.getAllSettings();
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      const successMessage = (req.session as any).sponsorshipAthleteSuccess;
      const errorMessage = (req.session as any).sponsorshipAthleteError;
      const formData = (req.session as any).sponsorshipAthleteFormData || {};
      (req.session as any).sponsorshipAthleteSuccess = null;
      (req.session as any).sponsorshipAthleteError = null;
      (req.session as any).sponsorshipAthleteFormData = null;
      (res.locals as any).layout = 'layout';
      (res.locals as any).pageTitle = 'Sponsorship Form for Athlete';
      res.render('sponsorship-athlete', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettings,
        successMessage,
        errorMessage,
        formData
      });
    } catch (error) {
      console.error('Error loading sponsorship athlete page:', error);
      (res.locals as any).pageTitle = 'Sponsorship Form for Athlete';
      res.render('sponsorship-athlete', {
        siteData: pagesService.getSiteData(),
        siteSettings: {},
        formData: {}
      });
    }
  });

  app.post('/contact-us', HomeController.contactSubmit);
  app.post('/sponsorship/event', (req: Request, res: Response, next: NextFunction) => {
    sponsorshipUpload.single('attachment')(req, res, (err: any) => {
      if (err) {
        (req.session as any).sponsorshipEventError = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 10 MB.' : 'Invalid file. Please upload a PDF or image (JPG, PNG, GIF, WebP).';
        (req.session as any).sponsorshipEventFormData = req.body || {};
        return res.redirect('/sponsorship/event');
      }
      next();
    });
  }, HomeController.sponsorshipSubmit);
  app.post('/sponsorship/athlete', (req: Request, res: Response, next: NextFunction) => {
    sponsorshipUpload.single('attachment')(req, res, (err: any) => {
      if (err) {
        (req.session as any).sponsorshipAthleteError = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 10 MB.' : 'Invalid file. Please upload a PDF or image (JPG, PNG, GIF, WebP).';
        (req.session as any).sponsorshipAthleteFormData = req.body || {};
        return res.redirect('/sponsorship/athlete');
      }
      next();
    });
  }, HomeController.sponsorshipSubmit);
  app.post('/newsletter', HomeController.newsletterSubmit);

  // Shop routes - SEO-friendly URLs
  app.get('/shop', ShopController.index);
  app.get('/products', ShopController.index); // All products page with filters
  app.get('/shop/category/:categorySlug', ShopController.index);
  app.get('/shop/brand/:brandSlug', ShopController.index);
  app.get('/shop/category/:categorySlug/brand/:brandSlug', ShopController.index);
  app.get('/shop/product/:slug', ShopController.detail);

  /** Meta Commerce Manager product catalog XML (published products). */
  app.get('/product-feed.xml', FacebookProductFeedController.productFeedXml);
  // Alternative product URL format (for backward compatibility)
  app.get('/shop/:slug', async (req: Request, res: Response, next: any) => {
    // Check if this is a product slug
    const slug = req.params.slug;
    if (slug && !['category', 'brand'].includes(slug)) {
      const productService = (await import('../services/productService')).default;
      const product = await productService.getProductBySlug(slug);
      if (product) {
        // Redirect to proper product URL
        return res.redirect(301, `/shop/product/${slug}`);
      }
    }
    next();
  });
  app.get('/cart', ShopController.cart);
  app.get('/checkout', ShopController.checkout);
  app.get('/checkout/pay', ShopController.checkoutPay);
  app.get('/checkout/complete', ShopController.checkoutComplete);
  app.get('/checkout/cancel', ShopController.checkoutCancel);
  app.get('/order-success', ShopController.orderSuccess);
  app.get('/order-error', ShopController.orderError);

  // Brands route
  app.get('/brands', async (req: Request, res: Response) => {
    try {
      const brandService = (await import('../services/brandService')).default;
      const brands = await brandService.getActiveBrands();
      (res.locals as any).pageTitle = 'Brands';
      const brandOg = brands.find((b: { logo_url?: string | null }) => b.logo_url && String(b.logo_url).trim())?.logo_url;
      if (brandOg) (res.locals as any).pageImage = String(brandOg).trim();
      res.render('brands', { brands });
    } catch (error) {
      console.error('Error rendering brands page:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Shop API routes
  app.post('/api/cart/add', ShopController.addToCart);
  app.post('/api/cart/update', ShopController.updateCartItem);
  app.post('/api/cart/remove', ShopController.removeCartItem);
  app.get('/api/product/:id', ShopController.getProductDetails);
  app.post('/api/checkout', ShopController.processCheckout);
  app.post('/api/discount/validate', ShopController.validateDiscount);
  app.post('/api/reviews/submit', ShopController.submitReview);
  app.get('/api/reviews/product/:product_id', ShopController.getReviews);
  app.get('/api/shipping/rates', ShopController.getShippingRates);
  app.post('/api/shipping/rates', ShopController.getShippingRates);
  app.get('/api/shipping/cities', ShopController.getShippingCities);
  app.get('/api/shipping/states', ShopController.getShippingStates);
  app.get('/api/checkout/payment-methods', ShopController.getCheckoutPaymentMethods);

  // OAuth routes
  app.get('/auth/google', AuthController.googleLogin);
  app.get('/auth/google/callback', AuthController.googleCallback);
  app.get('/auth/microsoft', AuthController.microsoftLogin);
  app.get('/auth/microsoft/callback', AuthController.microsoftCallback);
  app.get('/auth/facebook', AuthController.facebookLogin);
  app.get('/auth/facebook/callback', AuthController.facebookCallback);

  // Customer routes
  // Customer pages
  app.get('/customer/account', CustomerController.account);
  app.get('/customer/orders', CustomerController.ordersPage);
  app.get('/customer/orders/:orderNumber', CustomerController.orderDetailPage);
  app.get('/customer/addresses', CustomerController.addressesPage);
  app.get('/customer/wishlist', CustomerController.wishlistPage);
  // Public/Guest accessible wishlist route
  app.get('/wishlist', CustomerController.wishlistPage);
  app.get('/customer/login', CustomerController.loginPage);
  app.get('/customer/register', CustomerController.registerPage);
  app.get('/customer/forgot-password', CustomerController.forgotPasswordPage);
  app.get('/customer/reset-password/:token', CustomerController.resetPasswordPage);
  // Customer API routes
  app.post('/api/customer/register', CustomerController.register);
  app.post('/api/customer/login', CustomerController.login);
  app.post('/api/customer/forgot-password', CustomerController.forgotPassword);
  app.post('/api/customer/reset-password', CustomerController.resetPassword);
  app.post('/api/customer/logout', CustomerController.logout);
  app.get('/logout', CustomerController.logoutRedirect);
  app.get('/api/customer/profile', CustomerController.getProfile);
  app.post('/api/customer/profile', CustomerController.updateProfile);
  app.get('/api/customer/orders', CustomerController.getOrders);
  app.get('/api/customer/orders/:orderId/track', CustomerController.trackOrder);
  app.get('/api/customer/orders/:orderId', CustomerController.getOrder);
  app.get('/api/customer/addresses', CustomerController.getAddresses);
  app.post('/api/customer/addresses', CustomerController.addAddress);
  app.put('/api/customer/addresses/:addressId', CustomerController.updateAddress);
  app.delete('/api/customer/addresses/:addressId', CustomerController.deleteAddress);
  app.get('/api/customer/wishlist', CustomerController.getWishlist);
  app.post('/api/customer/wishlist/add', CustomerController.addToWishlist);
  app.post('/api/customer/wishlist/remove', CustomerController.removeFromWishlist);

  // Dynamic page route handler for pages defined in admin menu system
  app.get('/:pageSlug', async (req: Request, res: Response, next: NextFunction) => {
    const pageSlug = req.params.pageSlug;

    // Skip admin routes, static files, and reserved routes
    // Check for static file extensions (more specific than just checking for any dot)
    const staticFileExtensions = ['.css', '.js', '.json', '.xml', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.txt', '.html', '.htm', '.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ogv', '.mpg', '.mpeg'];
    const isStaticFile = staticFileExtensions.some(ext => pageSlug.toLowerCase().endsWith(ext));

    if (pageSlug.startsWith('admin') || isStaticFile || pageSlug === 'novosti' || pageSlug === 'objav' || pageSlug === 'video' || pageSlug === 'events') {
      return next();
    }

    try {
      // Get page data asynchronously
      const page = await adminPagesService.getPageBySlug(pageSlug);
      if (page && page.status === 'published') {
        (res.locals as any).pageContent = page.content || '';
        (res.locals as any).selected = page.slug || pageSlug; // Add page key for CSS class
        (res.locals as any).pageTitle = page.title || pageSlug; // Add page title
        (res.locals as any).pageDescription = (page as any).metaDescription || ''; // SEO meta description
        (res.locals as any).pageImage = page.pageImage || ''; // Add page image

        // Load gallery photos for this page
        const pagePhotos = await adminPagesService.getPagePhotos(page.id);
        (res.locals as any).pagePhotos = pagePhotos || [];

        // Check if this is a contact page and load site settings
        const isContactPage = pageSlug.toLowerCase().includes('kontakty') ||
          pageSlug.toLowerCase().includes('contact') ||
          pageSlug.toLowerCase().includes('адрес') ||
          pageSlug.toLowerCase().includes('телефон');

        if (isContactPage) {
          try {
            const siteSettings = await siteSettingsService.getAllSettings();
            (res.locals as any).siteSettings = siteSettings || {};
          } catch (error) {
            console.error('Error loading site settings for contact page:', error);
            (res.locals as any).siteSettings = {};
          }
        }

        res.render('page'); // Generic page template
      } else {
        // Check if it's a custom page that needs special handling
        if (pageSlug === 'who-we-are') {
          return res.render('about');
        } else if (pageSlug === 'contact') {
          return res.redirect('/contact-us');
        } else if (pageSlug.startsWith('what-we-do') || pageSlug.startsWith('Our-') || pageSlug === 'our-soft-skills' || pageSlug === 'our-it-system') {
          // For now, render a generic page template
          (res.locals as any).pageContent = `<h1>${pageSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1><p>This page is coming soon.</p>`;
          (res.locals as any).pageImage = '';
          return res.render('page');
        }
        next(); // Continue to 404 handler
      }
    } catch (error) {
      console.error('Error loading dynamic page:', error);
      next();
    }
  });

  // Admin routes - moved after main app routes to prevent conflicts
  app.get('/admin', (_req: Request, res: Response) => {
    res.redirect('/admin/login');
  });

  // Admin layout middleware - set admin layout for admin routes (except login)
  app.use('/admin', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine language preference first (used for both login and non-login pages)
      let currentLanguage: SupportedLanguage = 'en';
      if (req.session && (req.session as any).language) {
        const sessionLang = (req.session as any).language;
        if (i18nService.isSupportedLanguage(sessionLang)) {
          currentLanguage = sessionLang;
        }
      } else if (req.session && (req.session as any).user) {
        const userLang = await usersService.getUserById((req.session as any).user.id);
        if (userLang && (userLang as any).language && i18nService.isSupportedLanguage((userLang as any).language)) {
          currentLanguage = (userLang as any).language as SupportedLanguage;
        }
      }

      // Skip layout for login page
      if (req.path === '/login') {
        (res.locals as any).layout = false;
      } else {
        // Set admin layout for all other admin routes
        (res.locals as any).layout = 'admin-layout';

        // Pass user data from session to templates
        if (req.session && (req.session as any).user) {
          (res.locals as any).user = (req.session as any).user;
        } else {
          (res.locals as any).user = null;
        }

        // Pass admin menu to templates with role-based filtering and current detection
        const adminMenuService = AdminMenuService.getInstance();
        // Use baseUrl + path to get the full URL including the mount point (e.g., /admin/users)
        // req.path only gives the path relative to the mount point (e.g., /users)
        const currentPath = req.baseUrl + req.path;

        // Get menu with current property set based on URL
        let adminMenu: any[] = await adminMenuService.getMenuWithCurrent(currentPath, currentLanguage);

        // Filter menu based on user role if logged in
        if (req.session && (req.session as any).user) {
          const user = await usersService.getUserById((req.session as any).user.id);
          if (user && user.role) {
            // Filter by role after getting menu with current
            const filterByRole = (items: any[]): any[] => {
              return items.filter(item => {
                if (!item.isVisible) return false;
                if (item.roles.length === 0 || item.roles.includes(user.role)) {
                  // Recursively filter children
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

        // Inject top 10 tags as submenu items under Pages menu
        const pagesMenuItem = adminMenu.find((item: any) => item.title === 'Pages' || item.text === 'Pages' || item.url === '/admin/pages');
        if (pagesMenuItem) {
          try {
            // Check if we're on a pages-related route
            const isPagesRoute = req.path === '/admin/pages' || req.path.startsWith('/admin/pages/');
            const currentTag = req.query.tag as string;

            // Mark Pages menu item as active if on pages route
            if (isPagesRoute) {
              pagesMenuItem.current = true;
            }

            // Remove the static "Tags" menu item if it exists (we're dynamically adding tags)
            if (pagesMenuItem.children) {
              pagesMenuItem.children = pagesMenuItem.children.filter((child: any) =>
                child.title !== 'Tags' && child.text !== 'Tags'
              );
            }

            const topTags = await adminPagesService.getTopTags(10);

            // Ensure children array exists
            if (!pagesMenuItem.children) {
              pagesMenuItem.children = [];
            }

            // Add top tags as children
            topTags.forEach((tag: any) => {
              // Mark tag as active if it matches the current tag filter
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

            // Also mark the parent "Pages" link as active if on /admin/pages without a tag filter
            if (isPagesRoute && !currentTag && pagesMenuItem.children.length > 0) {
              // Find the parent link (first child with same URL as parent)
              const parentLink = pagesMenuItem.children.find((child: any) => child.url === pagesMenuItem.url);
              if (parentLink) {
                parentLink.current = true;
              }
            }
          } catch (error) {
            console.error('Error injecting tags into Pages menu:', error);
          }
        }

        (res.locals as any).adminMenu = adminMenu;

        // Pass theme data to templates
        const themeClasses = await themeService.getThemeClasses();
        (res.locals as any).themeClasses = themeClasses.join(' ');
        (res.locals as any).currentTheme = await themeService.getCurrentTheme();
      }

      // Provide translation helper and current language (after if/else block)
      (res.locals as any).currentLanguage = currentLanguage;
      (res.locals as any).t = (key: string, params?: Record<string, string | number>) => {
        return i18nService.translate(key, currentLanguage, params);
      };
      (res.locals as any).supportedLanguages = i18nService.getSupportedLanguages();
      (res.locals as any).getLanguageName = (lang: SupportedLanguage) => {
        return i18nService.getLanguageName(lang);
      };

      // Set RTL direction for Arabic
      if (currentLanguage === 'ar') {
        (res.locals as any).htmlDir = 'rtl';
        (res.locals as any).htmlLang = 'ar';
      } else {
        (res.locals as any).htmlDir = 'ltr';
        (res.locals as any).htmlLang = currentLanguage;
      }
      next();
    } catch (error) {
      console.error('Error in admin layout middleware:', error);
      next();
    }
  });

  // Use admin route modules
  app.use('/admin', adminRoutes);
}

/**
 * Configure 404 error handler
 */
export function configure404Handler(app: Express): void {
  app.use((req: Request, res: Response) => {
    try {
      const siteData = pagesService.getSiteData();
      const siteTitle = siteData.name || 'CMS';

      const seoData = pagesService.getSeoData('404', {
        pageTitle: `Page Not Found - ${siteTitle}`,
        pageDescription: 'The page you are looking for could not be found.',
        pageKeywords: '404, page not found',
        pageUrl: `${siteData.domain}${req.path}`,
        pageImage: siteData.logo,
        pageType: 'website',
        pageRobots: 'noindex, nofollow'
      });

      (res.locals as any).bodyClass = '404';
      res.status(404).render('404', seoData);
    } catch (error) {
      console.error('Error in 404 handler:', error);
      // Fallback to generic 404
      (res.locals as any).bodyClass = '404';
      res.status(404).render('404', {
        pageTitle: 'Page Not Found',
        pageDescription: 'The page you are looking for could not be found.',
        pageKeywords: '404, page not found'
      });
    }
  });
}
