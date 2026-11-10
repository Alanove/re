import type { Request } from 'express';
import { env } from '../config/env.js';
import { loadTransformConfig } from '../config/transform.js';
import { thumbUrl } from '../domain/media.js';
import { menuService } from '../services/menuService.js';
import { officesService } from '../services/officesService.js';
import { pagesService } from '../services/pagesService.js';
import { settingsService, whatsappChatUrl } from '../services/settingsService.js';
import { asyncHandler } from './asyncHandler.js';

export const CONTACT_ANCHOR = '/#ContactUs';

export const siteLocals = asyncHandler(async (req, res, next) => {
  const config = await loadTransformConfig();
  const [settings, mainMenu, footerMenu, offices, contactPage] = await Promise.all([
    settingsService.get(),
    menuService.resolve('main', req.path),
    menuService.resolve('footer', req.path),
    officesService.list(),
    pagesService.findPublishedByKey(config.legacy.contactPageKey)
  ]);
  res.locals.thumbUrl = thumbUrl;
  const baseUrl = resolveBaseUrl(req);
  res.locals.contactUrl = contactPage ? contactPage.url : CONTACT_ANCHOR;
  res.locals.settings = settings;
  res.locals.whatsappUrl = whatsappChatUrl(settings.whatsappNumber, `Hello ${settings.siteName}, `);
  res.locals.mainMenu = mainMenu;
  res.locals.footerMenu = footerMenu;
  res.locals.offices = offices;
  res.locals.primaryOffice = offices.find((office) => office.isPrimary) ?? offices[0] ?? null;
  res.locals.currentPath = req.path;
  res.locals.baseUrl = baseUrl;
  res.locals.year = new Date().getFullYear();
  res.locals.seo = {
    title: settings.seo.defaultTitle || settings.siteName,
    description: settings.seo.defaultDescription,
    keywords: settings.seo.defaultKeywords,
    image: settings.seo.defaultImage || settings.logo,
    type: 'website',
    canonical: `${baseUrl}${req.path === '/' ? '/' : req.path}`
  };
  next();
});

export function resolveBaseUrl(req: Request): string {
  const base = env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get('host') ?? 'localhost'}`;
  return base.replace(/\/+$/, '');
}
