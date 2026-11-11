import './loadEnv';
import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import helmet from 'helmet';
import pagesService from './services/pagesService';
import { SliderService } from './services/sliderService';
import { showProjects, showProjectDetail } from './controllers/projectsController';
import { HomeController } from './controllers/homeController';

import adminRoutes from '../admin/routes';
import { AdminMenuService } from '../admin/services/adminMenuService';
import { themeService } from '../admin/services/themeService';
import { SiteSettingsService } from '../admin/services/siteSettingsService';
import { usersService } from '../admin/services/usersService';
import { apartmentsService } from '../admin/services/apartmentsService';
import { CompoundAmenitiesService } from '../admin/services/compoundAmenitiesService';
import { configurePassport, passport } from './config/passport';
import memberRoutes from './routes/memberRoutes';
import apiRoutes from './api/routes';
import { ContactController } from './controllers/contactController';
import { StorageService } from '../admin/services/storageService';
import { ensureCsrfToken, validateCsrf } from './middleware/csrf';
import { contactRateLimiter } from './middleware/rateLimits';
import { requireRecaptcha, getRecaptchaSiteKey } from './services/recaptchaService';


const app = express();
const siteSettingsService = SiteSettingsService.getInstance();
const compoundAmenitiesService = CompoundAmenitiesService.getInstance();
const storageService = StorageService.getInstance();
const contactUpload = storageService.createContactUploadConfig();
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_SESSION_SECRET = 'lw-njs-cms-admin-secret';
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SESSION_SECRET)) {
  throw new Error('SESSION_SECRET must be set to a strong random value in production');
}

// Get the project root directory dynamically
const getProjectRoot = () => {
  // If running from dist directory, go up to project root
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../../');
  }
  // If running from src directory (development), go up to project root
  return path.resolve(__dirname, '../');
};

const projectRoot = getProjectRoot();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', [
  path.join(projectRoot, 'views'),
  path.join(projectRoot, 'admin/views')
]);

// aaPanel/Nginx often omits X-Forwarded-Proto. Without it, express-session refuses
// to set Secure cookies and login CSRF fails (token in HTML, no smb.sid cookie).
const appBaseUrl = process.env.APP_BASE_URL || '';
if (isProduction && appBaseUrl.startsWith('https://')) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers['x-forwarded-proto']) {
      req.headers['x-forwarded-proto'] = 'https';
    }
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://code.jquery.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://www.google.com/recaptcha/',
        'https://www.gstatic.com/recaptcha/',
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://ssl.google-analytics.com',
        'https://tagmanager.google.com'
      ],
      // Allow inline event handlers (onchange, onclick) used in EJS templates.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com'
      ],
      fontSrc: [
        "'self'",
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://fonts.gstatic.com',
        'data:'
      ],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      frameSrc: [
        "'self'",
        'https://www.google.com/recaptcha/',
        'https://recaptcha.google.com/',
        'https://www.google.com/',
        'https://maps.google.com/',
        'https://www.googletagmanager.com'
      ],
      connectSrc: [
        "'self'",
        'https://www.google.com/recaptcha/',
        'https://www.google-analytics.com',
        'https://analytics.google.com',
        'https://region1.google-analytics.com',
        'https://www.googletagmanager.com',
        'https://stats.g.doubleclick.net'
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  // Helmet's default same-origin COOP makes Chrome drop the session cookie
  // on the Google redirect back, so the callback never finishes the page load.
  crossOriginOpenerPolicy: false
}));

// Mobile app REST API: Bearer-token auth, so it is mounted before session/CSRF middleware.
app.use('/api/v1', apiRoutes);

app.use(express.static(path.join(projectRoot, 'public')));
app.use('/admin', express.static(path.join(projectRoot, 'admin/public')));
app.use(expressLayouts);
app.set('layout', 'layout');

// Session middleware (proxy + secure cookies: required behind Nginx/aaPanel HTTPS)
app.use(session({
  name: 'smb.sid',
  secret: sessionSecret,
  resave: false,
  // true so the CSRF token on the login page always gets a session cookie
  saveUninitialized: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    // Production is HTTPS (APP_BASE_URL); proto header is ensured above when missing
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

configurePassport();
app.use(passport.initialize());

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(ensureCsrfToken);
app.use((_req: Request, res: Response, next: NextFunction) => {
  (res.locals as any).recaptchaSiteKey = getRecaptchaSiteKey();
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  (res.locals as any).member = req.session?.member || null;
  (res.locals as any).impersonator = req.session?.impersonator || null;
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const pageKey = pagesService.getPageKeyFromPath(req.path);
  const seoData = pagesService.getSeoData(pageKey, {
    pageUrl: `${pagesService.getSiteData().domain}${req.path}`
  });
  
  (res.locals as any).items = pagesService.getMenuItems();
  (res.locals as any).selected = pageKey;
  (res.locals as any).siteData = pagesService.getSiteData();
  (res.locals as any).siteSettings = pagesService.getCachedSettings();
  
  // Set SEO data
  (res.locals as any).pageTitle = seoData.pageTitle;
  (res.locals as any).pageDescription = seoData.pageDescription;
  (res.locals as any).pageKeywords = seoData.pageKeywords;
  (res.locals as any).pageUrl = seoData.pageUrl;
  (res.locals as any).pageImage = seoData.pageImage;
  (res.locals as any).pageType = seoData.pageType;
  (res.locals as any).pageRobots = seoData.pageRobots;
  
  // Add current path as body class
  let bodyClass = req.path === '/' ? 'home' : req.path.slice(1).replace(/\//g, '-');
  
  // All project-related pages should have 'projects' class
  if (req.path.startsWith('/projects')) {
    bodyClass = 'projects';
  }
  
  // Add inner-page class for pages that use the inner page template
  if (req.path !== '/' && !req.path.startsWith('/admin') && !req.path.startsWith('/projects')) {
    bodyClass += ' inner-page';
  }
  
  (res.locals as any).bodyClass = bodyClass;
  
  next();
});

app.get('/', HomeController.index);

// About page — content from CMS (admin/pages/about)
app.get('/about', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const siteName = pagesService.getSiteData().name;
    const pageData = await pagesService.getPageBySlug('about');

    if (pageData?.content?.trim()) {
      const seoData = pagesService.getSeoData('about', {
        pageTitle: `${pageData.title || 'About'} - ${siteName}`,
        pageDescription:
          pageData.metaDescription ||
          'Learn about Santa Maria Bouar — a calm residential compound in Bouar with Lebanese-style architecture, green areas, swimming pool, and on-site services.',
        pageKeywords:
          pageData.metaKeywords ||
          'Santa Maria Bouar, about, Bouar compound, residential compound, Lebanese architecture, swimming pool',
        pageUrl: `${pagesService.getSiteData().domain}/about`,
      });
      Object.assign(res.locals, seoData);
      (res.locals as any).pageContent = pageData.content;
      (res.locals as any).pageTitle = pageData.title || 'About';
      (res.locals as any).selected = 'about';
      (res.locals as any).pageImage =
        (pageData as any).seoImage ||
        (pageData as any).backgroundImage ||
        (pageData as any).image ||
        '';
      return res.render('page');
    }

    // Fallback if CMS page is missing / empty
    const seoData = pagesService.getSeoData('about', {
      pageTitle: `About - ${siteName}`,
      pageDescription:
        'Learn about Santa Maria Bouar — a calm residential compound in Bouar with Lebanese-style architecture, green areas, swimming pool, and on-site services.',
      pageKeywords:
        'Santa Maria Bouar, about, Bouar compound, residential compound, Lebanese architecture, swimming pool',
      pageUrl: `${pagesService.getSiteData().domain}/about`,
    });
    Object.assign(res.locals, seoData);
    return res.render('about');
  } catch (error) {
    console.error('Error rendering about page:', error);
    return next(error);
  }
});

// Services page - read from database
app.get('/services', (_req: Request, res: Response) => {
  const pageData = pagesService.getPageData('services');
  if (pageData) {
    (res.locals as any).pageContent = pageData.content || '';
    (res.locals as any).backgroundImage = pageData.backgroundImage || '';
  }
  res.render('services');
});

app.get('/projects', showProjects);
app.get('/projects/categories/:category', showProjects);
app.get('/projects/countries/:country', showProjects);
app.get('/projects/:projectUrl', showProjectDetail);



// Apartments for Rent page (data-driven)
const renderApartmentsForRent = async (_req: Request, res: Response) => {
  try {
    const [pageData, apartments, compoundAmenities] = await Promise.all([
      pagesService.getPageBySlug('for-rent'),
      apartmentsService.getApartmentsByStatus('for_rent'),
      compoundAmenitiesService.getActiveAmenities()
    ]);
    const pageImage =
      pageData?.seoImage || pageData?.backgroundImage || '';
    (res.locals as any).pageContent = pageData?.content || '';
    (res.locals as any).pageImage = pageImage;
    if (pageData?.metaDescription) {
      (res.locals as any).pageDescription = pageData.metaDescription;
    }
    res.render('apartments-for-rent', {
      apartments,
      compoundAmenities,
      pageImage,
      pageTitle: pageData?.title || 'Apartments for Rent'
    });
  } catch (error) {
    console.error('Error rendering apartments for rent:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Apartments for Sale page (data-driven)
const renderApartmentsForSale = async (_req: Request, res: Response) => {
  try {
    const [pageData, apartments, compoundAmenities] = await Promise.all([
      pagesService.getPageBySlug('for-sale'),
      apartmentsService.getApartmentsByStatus('for_sale'),
      compoundAmenitiesService.getActiveAmenities()
    ]);
    const pageImage =
      pageData?.seoImage || pageData?.backgroundImage || '';
    (res.locals as any).pageContent = pageData?.content || '';
    (res.locals as any).pageImage = pageImage;
    if (pageData?.metaDescription) {
      (res.locals as any).pageDescription = pageData.metaDescription;
    }
    res.render('apartments-for-sale', {
      apartments,
      compoundAmenities,
      pageImage,
      pageTitle: pageData?.title || 'Apartments for Sale'
    });
  } catch (error) {
    console.error('Error rendering apartments for sale:', error);
    res.status(500).send('Internal Server Error');
  }
};

app.get('/apartments-for-rent', renderApartmentsForRent);
app.get('/apartments-for-sale', renderApartmentsForSale);
// Menu slug aliases — keep rent/sale pages data-driven regardless of menu URLs
app.get('/for-rent', renderApartmentsForRent);
app.get('/for-sale', renderApartmentsForSale);

// Public apartment detail (listed for rent/sale only)
app.get('/apartments/:id', async (req: Request, res: Response) => {
  try {
    const apartmentId = parseInt(req.params.id, 10);
    if (!apartmentId || Number.isNaN(apartmentId)) {
      res.status(404).render('404');
      return;
    }

    const [apartment, compoundAmenities] = await Promise.all([
      apartmentsService.getApartmentById(apartmentId),
      compoundAmenitiesService.getActiveAmenities()
    ]);
    if (!apartment || (apartment.status !== 'for_rent' && apartment.status !== 'for_sale')) {
      res.status(404).render('404');
      return;
    }

    const unitLabel = apartment.unitNumberOfficial || apartment.unitNumberUnofficial || apartment.id;
    const statusLabel = apartment.status === 'for_sale' ? 'For Sale' : 'For Rent';
    const listingText = apartment.listingDescription || apartment.notes || '';

    res.render('apartment-detail', {
      apartment,
      compoundAmenities,
      pageTitle: `Apartment ${unitLabel} — ${statusLabel} | Santa Maria Bouar`,
      pageDescription: listingText
        || `Apartment ${unitLabel} at Santa Maria Bouar — ${statusLabel.toLowerCase()}.`
    });
  } catch (error) {
    console.error('Error rendering apartment detail:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Projects Info page
app.get('/projects-info', (_req: Request, res: Response) => {
  const pageData = pagesService.getPageData('projects-info');
  if (pageData) {
    (res.locals as any).pageContent = pageData.content || '';
  }
  res.render('projects-info');
});

// About Compound page
app.get('/about-compound', (_req: Request, res: Response) => {
  const pageData = pagesService.getPageData('about-compound');
  if (pageData) {
    (res.locals as any).pageContent = pageData.content || '';
  }
  res.render('about-compound');
});

app.get('/privacy-policy', (_req: Request, res: Response) => {
  const siteName = pagesService.getSiteData().name;
  (res.locals as any).pageTitle = `Privacy Policy - ${siteName}`;
  (res.locals as any).pageDescription =
    'Learn how Santa Maria Bouar collects, stores, secures, and uses your personal data. We never sell or resell resident information.';
  res.render('privacy-policy');
});

app.get('/cookie-policy', (_req: Request, res: Response) => {
  const siteName = pagesService.getSiteData().name;
  (res.locals as any).pageTitle = `Cookie Policy - ${siteName}`;
  (res.locals as any).pageDescription =
    'List of cookies used on the Santa Maria Bouar website, including essential session cookies and Google Analytics.';
  res.render('cookie-policy');
});

app.get('/terms-and-conditions', (_req: Request, res: Response) => {
  const siteName = pagesService.getSiteData().name;
  (res.locals as any).pageTitle = `Terms and Conditions - ${siteName}`;
  (res.locals as any).pageDescription =
    'Terms and conditions for using the Santa Maria Bouar website and resident member portal.';
  res.render('terms-and-conditions');
});

app.get('/contact', ContactController.show);

app.post(
  '/contact',
  contactRateLimiter,
  (req, res, next) => {
    contactUpload.single('mapPicture')(req, res, (err: any) => {
      if (err) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'The site map photo must be 10 MB or smaller.'
            : err.message || 'Upload failed.';
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          res.status(400).json({ success: false, message });
          return;
        }
        res.redirect(`/contact?error=${encodeURIComponent(message)}`);
        return;
      }
      next();
    });
  },
  validateCsrf,
  requireRecaptcha,
  ContactController.submit
);

// Member / My Account portal
app.use('/account', memberRoutes);

// Dynamic page route handler for pages defined in admin menu system
app.get('/:pageSlug', async (req: Request, res: Response, next: NextFunction) => {
  const pageSlug = req.params.pageSlug;
  
  // Skip admin routes and static files
  if (pageSlug.startsWith('admin') || pageSlug.includes('.')) {
    return next();
  }
  
  try {
    // Try to load page from database
    const pageData = await pagesService.getPageBySlug(pageSlug);
    if (pageData && pageData.status === 'published') {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).backgroundImage = (pageData as any).backgroundImage || '';
      (res.locals as any).selected = pageData.slug || pageSlug; // Add page key for CSS class
      (res.locals as any).pageTitle = pageData.title || pageData.slug || pageSlug; // Add page title
      (res.locals as any).pageImage =
        (pageData as any).seoImage ||
        (pageData as any).backgroundImage ||
        (pageData as any).image ||
        '';
      res.render('page'); // Generic page template
      return;
    }
    
    // Check if it's a custom page that needs special handling
    if (pageSlug === 'who-we-are') {
      return res.render('about');
    } else if (pageSlug === 'contact-us') {
      return res.redirect('/contact');
    } else if (pageSlug.startsWith('what-we-do') || pageSlug.startsWith('Our-') || pageSlug === 'our-soft-skills' || pageSlug === 'our-it-system') {
      // For now, render a generic page template
      (res.locals as any).pageContent = `<h1>${pageSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1><p>This page is coming soon.</p>`;
      (res.locals as any).backgroundImage = '';
      return res.render('page');
    }
    
    next(); // Continue to 404 handler
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
    // Skip layout for login page
    if (req.path === '/login') {
      (res.locals as any).layout = false;
    } else {
      // Set admin layout for all other admin routes
      (res.locals as any).layout = 'admin-layout';
      
      // Pass user data from session to templates
      if (req.session && (req.session as any).user) {
        const sessionUser = (req.session as any).user;
        (res.locals as any).user = sessionUser;
        (res.locals as any).isSuperAdmin = sessionUser.role === 'Super Admin';
        (res.locals as any).canEditAdmin = sessionUser.role === 'Super Admin';
      } else {
        (res.locals as any).user = null;
        (res.locals as any).isSuperAdmin = false;
        (res.locals as any).canEditAdmin = false;
      }
      
      // Pass admin menu to templates with role-based filtering
      const adminMenuService = AdminMenuService.getInstance();
      let adminMenu: any[] = [];
      
      // Filter menu based on user role if logged in
      if (req.session && (req.session as any).user) {
        const user = await usersService.getUserById((req.session as any).user.id);
        if (user && user.role) {
          adminMenu = await adminMenuService.getMenuForUser(user.role);
        } else {
          adminMenu = await adminMenuService.getAllMenuItems();
        }
      } else {
        adminMenu = await adminMenuService.getAllMenuItems();
      }
      
      // Calculate active state for menu items
      adminMenu = adminMenuService.setActiveMenu(adminMenu, req.originalUrl);
      
      (res.locals as any).adminMenu = adminMenu;
      
      // Pass theme data to templates
      const themeClasses = await themeService.getThemeClasses();
      (res.locals as any).themeClasses = themeClasses.join(' ');
      (res.locals as any).currentTheme = await themeService.getCurrentTheme();
    }
    next();
  } catch (error) {
    console.error('Error in admin layout middleware:', error);
    next();
  }
});

// Use admin route modules
app.use('/admin', adminRoutes);

// 404 handler
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

const PORT = (process.env as any).PORT || 3002;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize pagesService cache (this will create the connection pool)
    await pagesService.initialize();
    console.log('✅ Database and cache initialized');

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 