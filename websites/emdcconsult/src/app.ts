import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import pagesService, { formatDocumentTitle } from './services/pagesService';
import { SliderService } from './services/sliderService';
import { showProjects, showProjectDetail, getProjectApiData } from './controllers/projectsController';
import { HomeController } from './controllers/homeController';
import { ClientsController } from './controllers/clientsController';
import { PagesController } from './controllers/pagesController';
import { validatePageImages } from './middleware/imageValidation';

import adminRoutes from '../admin/routes';
import { AdminMenuService } from '../admin/services/adminMenuService';
import { themeService } from '../admin/services/themeService';
import { SiteSettingsService } from '../admin/services/siteSettingsService';


const app = express();
const siteSettingsService = SiteSettingsService.getInstance();

app.locals.formatDocumentTitle = formatDocumentTitle;

// Trust proxy - REQUIRED when running behind nginx or any reverse proxy
app.set('trust proxy', 1);

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

app.set('view engine', 'ejs');
app.set('views', [
  path.join(projectRoot, 'views'),
  path.join(projectRoot, 'admin/views')
]);

app.use(express.static(path.join(projectRoot, 'public')));
app.use('/admin', express.static(path.join(projectRoot, 'admin/public')));
app.use(expressLayouts);
app.set('layout', 'layout');

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'lw-njs-cms-admin-secret-change-in-production',
  name: 'emdc.sid', // Custom session cookie name
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS), false in development (HTTP)
    httpOnly: true,
    sameSite: 'lax', // Allow cookies on redirects
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/' // Ensure cookie is available for all paths
  }
}));

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const pageKey = pagesService.getPageKeyFromPath(req.path);
  const seoData = pagesService.getSeoData(pageKey, {
    pageUrl: `${pagesService.getSiteData().domain}${req.path}`
  });
  
  (res.locals as any).items = pagesService.getMenuItems();
  (res.locals as any).selected = pageKey;
  (res.locals as any).siteData = pagesService.getSiteData();
  
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
  
  // Add light-background class to all pages
  bodyClass += ' light-background';
  
  (res.locals as any).bodyClass = bodyClass;
  (res.locals as any).isDocumentTitleHome = req.path === '/' || req.path === '';

  next();
});

app.get('/', HomeController.index);
app.get('/careers', PagesController.careers);
app.get('/news', PagesController.news);
app.get('/news/:key', PagesController.newsDetail);

// Services page - read from database
app.get('/services', PagesController.services);

app.get('/projects', showProjects);
app.get('/projects/categories/:category', showProjects);
app.get('/projects/countries/:country', showProjects);
app.get('/projects/regions/:region', showProjects);
app.get('/api/projects/:projectUrl', getProjectApiData);
app.get('/projects/:projectUrl', showProjectDetail);

app.get('/clients', ClientsController.index);



app.get('/contact', PagesController.contact);

// Dynamic page route handler for pages defined in admin menu system
app.get('/:pageSlug', validatePageImages, PagesController.dynamicPage);

// Admin routes - moved after main app routes to prevent conflicts
app.get('/admin', (_req: Request, res: Response) => {
  res.redirect('/admin/login');
});

// Admin layout middleware - set admin layout for admin routes (except login)
app.use('/admin', (req: Request, res: Response, next: NextFunction) => {
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
    
    // Pass admin menu to templates
    const adminMenuService = AdminMenuService.getInstance();
    const adminMenu = adminMenuService.getMenuItems();
    // Set active menu item based on current URL
    adminMenuService.setActiveMenuItem(req.originalUrl);
    (res.locals as any).adminMenu = adminMenu;
    
    // Pass theme data to templates
    const themeClasses = themeService.getThemeClasses();
    (res.locals as any).themeClasses = themeClasses.join(' ');
    (res.locals as any).currentTheme = themeService.getCurrentTheme();
  }
  next();
});

// Use admin route modules
app.use('/admin', adminRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  try {
    const siteSettings = siteSettingsService.getAllSettings();
    const siteTitle = siteSettings.siteTitle || 'CMS';
    
    const seoData = pagesService.getSeoData('home', {
      pageTitle: `Page Not Found - ${siteTitle}`,
      pageDescription: 'The page you are looking for could not be found.',
      pageKeywords: '404, page not found',
      pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
      pageImage: pagesService.getSiteData().logo,
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

const PORT = (process.env as any).PORT || 3021;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 