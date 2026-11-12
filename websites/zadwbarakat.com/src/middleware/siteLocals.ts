import type { Request } from 'express';
import { env } from '../config/env.js';
import { loadTransformConfig } from '../config/transform.js';
import { thumbUrl } from '../domain/media.js';
import { decodeRequestPath, encodePath } from '../lib/paths.js';
import { menuService } from '../services/menuService.js';
import { pagesService } from '../services/pagesService.js';
import { settingsService } from '../services/settingsService.js';
import { asyncHandler } from './asyncHandler.js';

export const siteLocals = asyncHandler(async (req, res, next) => {
  const config = await loadTransformConfig();
  const sitePath = decodeRequestPath(req.path);
  const [settings, mainMenu, footerMenu, contactPage] = await Promise.all([
    settingsService.get(),
    menuService.resolve('main', sitePath),
    menuService.resolve('footer', sitePath),
    pagesService.findPublishedByKey(config.legacy.contactPageKey)
  ]);
  const baseUrl = resolveBaseUrl(req);
  res.locals.thumbUrl = thumbUrl;
  res.locals.encodePath = encodePath;
  res.locals.contactUrl = contactPage ? contactPage.url : '/#newsletter';
  res.locals.settings = settings;
  res.locals.mainMenu = mainMenu;
  res.locals.footerMenu = footerMenu;
  res.locals.currentPath = sitePath;
  res.locals.baseUrl = baseUrl;
  res.locals.year = new Date().getFullYear();
  res.locals.searchQuery = '';
  res.locals.contentDir = 'rtl';
  res.locals.contentLang = 'ar';
  res.locals.robots = 'index,follow';
  res.locals.seo = {
    title: settings.seo.defaultTitle || settings.siteName,
    description: settings.seo.defaultDescription || settings.description,
    keywords: settings.seo.defaultKeywords,
    image: settings.seo.defaultImage || settings.logo,
    type: 'website',
    canonical: `${baseUrl}${sitePath === '/' ? '/' : encodePath(sitePath)}`
  };
  next();
});

export function resolveBaseUrl(req: Request): string {
  const base = env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get('host') ?? 'localhost'}`;
  return base.replace(/\/+$/, '');
}
