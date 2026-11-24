import type { Request, Response } from 'express';
import { thumbUrl } from '../domain/media.js';
import type { Settings } from '../domain/models.js';
import { NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { pagesService, type PageNode } from '../services/pagesService.js';
import { excerpt } from '../services/sanitizeService.js';

const CIRCLE_KEYS = ['our-model', 'our-services', 'our-presence', 'about-us', 'reach-us'] as const;

function pageSeo(res: Response, page: PageNode, type = 'website'): void {
  const settings = res.locals.settings as Settings;
  const seo = res.locals.seo as Record<string, string>;
  res.locals.seo = {
    ...seo,
    title: page.seo.title || `${page.title} | ${settings.siteName}`,
    description: page.seo.description || page.summary || excerpt(page.content, 160) || seo.description,
    keywords: page.seo.keywords || seo.keywords,
    image: page.heroImage || seo.image,
    type
  };
}

function circleSlug(page: PageNode | null): string {
  if (!page) {
    return '';
  }
  if ((CIRCLE_KEYS as readonly string[]).includes(page.key)) {
    return page.key;
  }
  return page.slug;
}

export class PublicController {
  public static async home(_req: Request, res: Response): Promise<void> {
    const page = await pagesService.findPublishedByKey('home');
    if (!page) {
      throw new NotFoundError('Home page not found.');
    }
    const settings = res.locals.settings as Settings;
    const seo = res.locals.seo as Record<string, string>;
    res.locals.seo = {
      ...seo,
      title: settings.seo.defaultTitle || settings.siteName,
      description: settings.seo.defaultDescription || page.summary || settings.description || seo.description,
      image: settings.seo.defaultImage || page.heroImage || seo.image
    };
    res.render('home', {
      page,
      bodyClass: 'home',
      showCircles: true,
      homeCircles: true,
      circleSlug: '',
      footerClass: '',
      headerBigger: false,
      showMap: false,
      headerImageClass: ''
    });
  }

  public static async page(req: Request, res: Response): Promise<void> {
    const page = await pagesService.findPublishedByPath(req.path);
    if (!page) {
      const legacy = await PublicController.legacyRedirect(req.path);
      if (legacy) {
        res.redirect(301, legacy);
        return;
      }
      throw new NotFoundError(`No page exists at ${req.path}.`);
    }
    if (page.url !== req.path) {
      const query = req.originalUrl.slice(req.originalUrl.indexOf('?') === -1 ? req.originalUrl.length : req.originalUrl.indexOf('?'));
      res.redirect(301, `${page.url}${query}`);
      return;
    }
    await PublicController.renderPage(res, page);
  }

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const pages = (await pagesService.getPublishedTree()).flatMap(function flat(node): PageNode[] {
      return [node, ...node.children.flatMap(flat)];
    });
    const urls = [...new Set(['/', ...pages.filter((page) => page.key !== 'home').map((page) => page.url)])];
    const body = urls.map((url) => `  <url><loc>${baseUrl}${url === '/' ? '/' : url}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static async renderPage(res: Response, page: PageNode): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    pageSeo(res, published);
    const isPresence = published.key === 'our-presence';
    const isContact = published.kind === 'contact' || published.key === 'reach-us';
    const [galleryImages, testimonialImages, clientImages] = isPresence
      ? await Promise.all([
          PublicController.imagesForKey('galleries'),
          PublicController.imagesForKey('testimonials'),
          PublicController.imagesForKey('clients')
        ])
      : [[], [], []];

    const view = isContact ? 'contact' : isPresence ? 'presence' : 'page';
    res.render(view, {
      page: published,
      galleryImages,
      testimonialImages,
      clientImages,
      bodyClass: `inside ${published.key}`,
      showCircles: !isPresence && !isContact,
      homeCircles: false,
      circleSlug: circleSlug(published),
      footerClass: isContact ? 'reach-us' : '',
      headerBigger: isPresence,
      showMap: isContact,
      headerImageClass: isContact ? 'reach-us' : isPresence ? 'bigger' : ''
    });
  }

  private static async imagesForKey(key: string): Promise<Array<{ src: string; thumb: string; caption: string }>> {
    const page = await pagesService.findPublishedByKey(key);
    if (!page) {
      return [];
    }
    const images = await pagesService.getPageImages(page.id);
    return images.map((image) => ({
      src: image.src,
      thumb: thumbUrl(image.src),
      caption: image.caption
    }));
  }

  private static async legacyRedirect(requestPath: string): Promise<string | null> {
    const segments = requestPath.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) {
      return null;
    }
    const page = await pagesService.findPublishedByKey(last.toLowerCase());
    return page && page.url !== requestPath ? page.url : null;
  }
}
