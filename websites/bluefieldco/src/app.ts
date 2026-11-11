import './loadEnv';
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import pagesService from './services/pagesService';
import { DATA_PATHS } from './constants/data-paths';
import { ImageUtils } from './utils/imageUtils';
import { getMenuItems, getUtilityMenuItems, getFooterMenuItems } from './services/menuService';
import { HomeController } from './controllers/homeController';
import { PagesController } from './controllers/pagesController';
import { FormsController } from './controllers/formsController';

import adminRoutes from '../admin/routes';
import { AdminMenuService } from '../admin/services/adminMenuService';
import { themeService } from '../admin/services/themeService';
import { SiteSettingsService } from '../admin/services/siteSettingsService';

const app = express();
const siteSettingsService = SiteSettingsService.getInstance();

app.set('trust proxy', 1);

const getProjectRoot = () => {
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../../');
  }
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

app.use(session({
  secret: process.env.SESSION_SECRET || 'lw-njs-cms-admin-secret-change-in-production',
  name: 'bluefield.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const careersCvUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(DATA_PATHS.FORM_UPLOADS_DIR, { recursive: true });
      cb(null, DATA_PATHS.FORM_UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  }
});

const SUSTAINABILITY_REDIRECTS: Record<string, string> = {
  '/waste-management': '/sustainability/environmental-sustainability/waste-management',
  '/tree-planting': '/sustainability/environmental-sustainability/tree-planting',
  '/eco-friendly-pesticides': '/sustainability/environmental-sustainability/eco-friendly-pesticides',
  '/supporting-farmers': '/sustainability/social-responsibility/supporting-farmers',
  '/women-empowerment-through-agriculture': '/sustainability/social-responsibility/women-empowerment-through-agriculture',
  '/partnerships-for-sustainable-progress': '/sustainability/social-responsibility/partnerships-for-sustainable-progress',
  '/empowering-youths-though-agriculture': '/sustainability/social-responsibility/empowering-youths-though-agriculture',
  '/bluefields-partnership-with-ministries-of-agriculture-for-workforce-development':
    '/sustainability/social-responsibility/bluefields-partnership-with-ministries-of-agriculture-for-workforce-development'
};

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/admin')) {
    return next();
  }

  const pageKey = pagesService.getPageKeyFromPath(req.path);
  const seoData = pagesService.getSeoData(pageKey, {
    pageUrl: `${pagesService.getSiteData().domain}${req.path}`
  });

  (res.locals as any).items = getMenuItems();
  (res.locals as any).mainMenu = getMenuItems();
  (res.locals as any).utilityMenu = getUtilityMenuItems();
  (res.locals as any).footerMenu = getFooterMenuItems();
  (res.locals as any).selected = pageKey;
  (res.locals as any).siteData = pagesService.getSiteData();
  (res.locals as any).siteSettings = siteSettingsService.getAllSettings();

  (res.locals as any).pageTitle = seoData.pageTitle;
  (res.locals as any).pageDescription = seoData.pageDescription;
  (res.locals as any).pageKeywords = seoData.pageKeywords;
  (res.locals as any).pageUrl = seoData.pageUrl;
  (res.locals as any).pageImage = seoData.pageImage;
  (res.locals as any).pageType = seoData.pageType;
  (res.locals as any).pageRobots = seoData.pageRobots;

  if (req.path !== '/') {
    const pageByUrl = pagesService.getPageByUrl(req.path);
    const pageData = pageByUrl || pagesService.getPageData(pageKey);
    (res.locals as any).pageImage = ImageUtils.getPageHeaderImageFromPage(pageData);
  }

  let bodyClass = 'wp-custom-logo hfeed';
  if (req.path === '/') {
    bodyClass += ' home blog no-sidebar';
  } else {
    bodyClass += ' page-template-default page no-sidebar';
  }

  (res.locals as any).bodyClass = bodyClass;
  next();
});

app.get('/news-events', (_req, res) => res.redirect(301, '/news'));
app.get('/news-events/', (_req, res) => res.redirect(301, '/news'));
app.get('/sector/pest-control-and-management', (_req, res) => res.redirect(301, '/sector/pest-management'));

Object.entries(SUSTAINABILITY_REDIRECTS).forEach(([from, to]) => {
  app.get(from, (_req, res) => res.redirect(301, to));
});

app.post('/api/forms/contact', FormsController.submitContact);
app.post(
  '/api/forms/careers',
  (req, res, next) => {
    careersCvUpload.single('your-file')(req, res, (err) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'CV file is too large (max 5 MB).'
            : err.message || 'Invalid file upload.';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  },
  FormsController.submitCareers
);

app.get('/', HomeController.index);
app.get('/search', PagesController.search);
app.get('/news', PagesController.news);
app.get('/news/', PagesController.news);
app.get('/news/:key', PagesController.newsDetail);

app.get('/admin', (_req: Request, res: Response) => {
  res.redirect('/admin/login');
});

app.use('/admin', (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/login') {
    (res.locals as any).layout = false;
  } else {
    (res.locals as any).layout = 'admin-layout';
    if (req.session && (req.session as any).user) {
      (res.locals as any).user = (req.session as any).user;
    } else {
      (res.locals as any).user = null;
    }
    const adminMenuService = AdminMenuService.getInstance();
    adminMenuService.setActiveMenuItem(req.originalUrl);
    (res.locals as any).adminMenu = adminMenuService.getMenuItems();
    const themeClasses = themeService.getThemeClasses();
    (res.locals as any).themeClasses = themeClasses.join(' ');
    (res.locals as any).currentTheme = themeService.getCurrentTheme();
  }
  next();
});

app.use('/admin', adminRoutes);

app.get(/^(?!\/admin)(?!.*\.\w+$).+/, PagesController.dynamicPageByPath);

app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/admin')) {
    return res.status(404).send('Not found');
  }
  try {
    const siteSettings = siteSettingsService.getAllSettings();
    const siteTitle = siteSettings.siteTitle || 'BlueField Group';
    const seoData = pagesService.getSeoData('home', {
      pageTitle: `Page Not Found - ${siteTitle}`,
      pageDescription: 'The page you are looking for could not be found.',
      pageKeywords: '404',
      pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
      pageImage: pagesService.getSiteData().logo,
      pageType: 'website',
      pageRobots: 'noindex, nofollow'
    });
    (res.locals as any).bodyClass = 'error404';
    res.status(404).render('404', seoData);
  } catch (error) {
    console.error('Error in 404 handler:', error);
    (res.locals as any).bodyClass = 'error404';
    res.status(404).render('404', { pageTitle: 'Page Not Found', pageDescription: '', pageKeywords: '' });
  }
});

const PORT = (process.env as any).PORT || 3019;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
