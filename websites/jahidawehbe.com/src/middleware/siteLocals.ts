import type { Request } from 'express';
import { env } from '../config/env.js';
import { thumbUrl } from '../domain/media.js';
import { menuService } from '../services/menuService.js';
import { settingsService } from '../services/settingsService.js';
import { socialService } from '../services/socialService.js';
import { asyncHandler } from './asyncHandler.js';

export const siteLocals = asyncHandler(async (req, res, next) => {
  const [settings, mainMenu, footerMenu, social] = await Promise.all([
    settingsService.get(),
    menuService.resolve('main', req.path),
    menuService.resolve('footer', req.path),
    socialService.get()
  ]);
  const baseUrl = resolveBaseUrl(req);
  res.locals.thumbUrl = thumbUrl;
  res.locals.settings = settings;
  res.locals.mainMenu = mainMenu;
  res.locals.footerMenu = footerMenu;
  res.locals.socialLinks = socialService.links(social);
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
