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
import { ProductsController } from './controllers/productsController';

import adminRoutes from '../admin/routes';
import { AdminMenuService } from '../admin/services/adminMenuService';
import { themeService } from '../admin/services/themeService';
import { SiteSettingsService } from '../admin/services/siteSettingsService';
import { NewsService } from '../admin/services/newsService';
import productsService from './services/productsService';

const app = express();
const siteSettingsService = SiteSettingsService.getInstance();
const newsService = NewsService.getInstance();

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

app.use(express.static(path.join(projectRoot, 'public'), { redirect: false }));
app.use('/admin', express.static(path.join(projectRoot, 'admin/public')));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(session({
  secret: process.env.SESSION_SECRET || 'lw-njs-cms-admin-secret-change-in-production',
  name: 'solu.sid',
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

const SUSTAINABILITY_REDIRECTS: Record<string, string> = {};

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/') && !req.path.startsWith('/admin')) {
    res.redirect(301, req.path.slice(0, -1));
    return;
  }
  if (req.method === 'GET' && /\.htm\/?$/i.test(req.path) && !req.path.startsWith('/admin')) {
    res.redirect(301, req.path.replace(/\.htm\/?$/i, '') || '/');
    return;
  }
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
  (res.locals as any).companyPages = pagesService.getCompanyPages();
  (res.locals as any).currentPage = pagesService.getPageByUrl(req.path) || pagesService.getPageData(pageKey);

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

  let bodyClass = 'wp-custom-logo hfeed ehf-header ehf-footer ehf-template-manufacturer ehf-stylesheet-manufacturer man_button_round elementor-default elementor-kit-6';
  if (req.path === '/') {
    bodyClass += ' home page-template-default page no-sidebar elementor-page elementor-page-1470';
  } else {
    bodyClass += ' page-template-default page no-sidebar';
  }
  if (/^\/products?(?:\/|$)/.test(req.path) || req.path.startsWith('/product-category/') || req.path.startsWith('/product/')) {
    bodyClass += ' woocommerce woocommerce-page';
  }

  (res.locals as any).bodyClass = bodyClass;
  (res.locals as any).isHome = req.path === '/';

  const cleanPath = req.path.replace(/\/+$/, '') || '/';
  if (cleanPath !== '/') {
    const categoryPath = cleanPath.match(/^\/product-category\/([^/]+)(?:\/page\/\d+)?$/);
    const productPath = cleanPath.match(/^\/product\/([^/]+?)(?:\.htm)?$/);
    if (/^\/products(?:\/page\/\d+)?$/.test(cleanPath)) {
      (res.locals as any).introTitle = 'Products';
      (res.locals as any).introCrumbs = [{ label: 'Shop' }];
    } else if (categoryPath) {
      const category = productsService.getCategory(categoryPath[1]);
      const name = category ? category.name : 'Products';
      (res.locals as any).introTitle = name;
      (res.locals as any).introCrumbs = [{ href: '/products', label: 'Shop' }, { label: name }];
    } else if (productPath) {
      const product = productsService.getByKey(productPath[1]);
      if (product) {
        const category = productsService.getCategoriesWithCounts().find((item) => (product.categories || [])[0] === item.slug);
        const crumbs: { href?: string; label: string }[] = [{ href: '/products', label: 'Shop' }];
        if (category) crumbs.push({ href: `/product-category/${category.slug}`, label: category.name });
        crumbs.push({ label: product.title });
        (res.locals as any).introTitle = product.title;
        (res.locals as any).introCrumbs = crumbs;
      }
    } else {
      const page = pagesService.getPageByUrl(cleanPath);
      if (page && page.url !== '/') {
        const crumbs: { href?: string; label: string }[] = [];
        const parentKey = (page as { parentKey?: string }).parentKey;
        if (parentKey) {
          const parent = pagesService.getPageData(parentKey);
          if (parent) crumbs.push({ href: parent.url, label: parent.title });
        }
        crumbs.push({ label: page.title });
        (res.locals as any).introTitle = page.title;
        (res.locals as any).introCrumbs = crumbs;
      }
    }
  }

  let chrome: { headerHtml?: string; footerHtml?: string; headerCss?: string; footerCss?: string } = {};
  try {
    chrome = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'chrome.json'), 'utf8'));
  } catch {
    chrome = {};
  }
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isNewsPath = req.path === '/news' || req.path.startsWith('/news/')
    || newsService.getPublishedNews().some((item) => item.url === req.path);
  const activePath = isNewsPath ? '/category/news' : req.path;
  const renderMenuItems = (items: ReturnType<typeof getMenuItems>): string => (items || []).map((item) => {
    const children = (item.children || []).filter((child) => child.active !== false);
    const classes = ['menu-item'];
    if (item.url === activePath) classes.push('current-menu-item');
    if (children.some((child) => child.url === activePath)) classes.push('current-menu-parent');
    if (children.length) classes.push('menu-item-has-children');
    const sub = children.length ? `<ul class="sub-menu">${renderMenuItems(children)}</ul>` : '';
    return `<li class="${classes.join(' ')}"><a href="${esc(item.url)}">${esc(item.title)}</a>${sub}</li>`;
  }).join('');
  const menuHtml = `<ul id="sm_nav_menu" class="sm_nav_menu">${renderMenuItems(getMenuItems())}</ul>`;
  let headerHtml = chrome.headerHtml || '';
  if (headerHtml.includes('<!--SOLU_MENU-->')) {
    headerHtml = headerHtml.split('<!--SOLU_MENU-->').join(menuHtml);
  } else {
    headerHtml = menuHtml + headerHtml;
  }
  const settings = siteSettingsService.getAllSettings();
  const phone = (settings.contactPhone || '').trim();
  const email = (settings.contactEmail || '').trim();
  const tel = phone.replace(/[^\d+]/g, '').replace(/^00/, '+');
  headerHtml = headerHtml
    .split('<!--SOLU_PHONE-->').join(phone ? `<a href="tel:${esc(tel)}" class="btn_link">${esc(phone)}</a>` : '')
    .split('<!--SOLU_EMAIL-->').join(email ? `<a href="mailto:${esc(email)}" target="_blank" class="btn_link">${esc(email)}</a>` : '');
  (res.locals as any).chromeData = chrome;
  (res.locals as any).headerHtml = headerHtml;
  (res.locals as any).footerHtml = (chrome.footerHtml || '').replace(/(©|&copy;)\s*\d{4}/g, `$1${new Date().getFullYear()}`);
  (res.locals as any).latestNews = newsService.getPublishedNews().slice(0, 3);
  (res.locals as any).recaptchaSiteKey = siteSettingsService.getRecaptchaSiteKey();
  next();
});

app.post('/api/forms/contact', FormsController.submitContact);

app.get('/', HomeController.index);
app.get('/search', PagesController.search);
app.get('/news', PagesController.news);
app.get('/news/', PagesController.news);
app.get('/news/:key', PagesController.newsDetail);
app.get('/contact-us', PagesController.contact);
app.get('/contact-us/', PagesController.contact);
app.get('/product-category/:slug/page/:page', ProductsController.category);
app.get('/product-category/:slug', ProductsController.category);
app.get('/product/:slug', ProductsController.detail);
app.get('/category/:slug', PagesController.newsCategory);
app.get(/^\/(?!admin\/)(.+)\.htm\/?$/, (req: Request, res: Response) => {
  res.redirect(301, req.path.replace(/\.htm\/?$/i, '') || '/');
});

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
    const siteTitle = siteSettings.siteTitle || 'Solutec';
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

const PORT = (process.env as any).PORT || 3030;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
