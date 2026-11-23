import type { Request, Response } from 'express';
import { loadTransformConfig } from '../config/transform.js';
import type { Settings } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { safeParseFields } from '../middleware/validate.js';
import { contactFormSchema, feedbackFormSchema } from '../schemas/publicSchemas.js';
import { albumsService } from '../services/albumsService.js';
import { captchaService } from '../services/captchaService.js';
import { contactService } from '../services/contactService.js';
import { homeService } from '../services/homeService.js';
import { pagesService, type PageNode } from '../services/pagesService.js';
import { videosService } from '../services/videosService.js';
import { excerpt } from '../services/sanitizeService.js';

interface ContactFormState {
  values: Record<string, string>;
  errors: Record<string, string>;
  sent: boolean;
  message: string;
}

function emptyForm(sent = false): ContactFormState {
  return { values: {}, errors: {}, sent, message: '' };
}

function wantsJson(req: Request): boolean {
  return (req.get('accept') ?? '').includes('application/json');
}

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

export class PublicController {
  public static async home(req: Request, res: Response): Promise<void> {
    await PublicController.renderHome(res, emptyForm(req.query.sent === '1'));
  }

  public static async album(req: Request, res: Response): Promise<void> {
    const key = String(req.params.albumKey ?? '');
    const album = await albumsService.findPublishedByKey(key);
    if (!album) {
      throw new NotFoundError('Photo album not found.');
    }
    const settings = res.locals.settings as Settings;
    const seo = res.locals.seo as Record<string, string>;
    res.locals.seo = {
      ...seo,
      title: `${album.title} | ${settings.siteName}`,
      description: album.summary || seo.description,
      image: album.cover || seo.image
    };
    res.render('album', { album, albumUrl: albumsService.url(album), bodyClass: 'inside photos' });
  }

  public static async video(req: Request, res: Response): Promise<void> {
    const key = String(req.params.videoKey ?? '');
    const video = await videosService.findPublishedByKey(key);
    if (!video) {
      throw new NotFoundError('Video not found.');
    }
    const settings = res.locals.settings as Settings;
    const seo = res.locals.seo as Record<string, string>;
    res.locals.seo = {
      ...seo,
      title: `${video.title} | ${settings.siteName}`,
      description: video.summary || seo.description,
      image: video.thumb || seo.image
    };
    res.render('video', { video, videoUrl: videosService.url(video), bodyClass: 'inside videos' });
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
    await PublicController.renderPage(res, page, emptyForm(req.query.sent === '1'));
  }

  public static async submitContact(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(contactFormSchema, req.body);
    if (!parsed.ok) {
      await PublicController.respondWithErrors(req, res, parsed.fields, 'contact');
      return;
    }
    try {
      captchaService.verify(parsed.data.captcha, 'contact', req.ip ?? '');
      await contactService.submit(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' });
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await PublicController.respondWithErrors(req, res, error.fields, 'contact');
        return;
      }
      throw error;
    }
    if (wantsJson(req)) {
      res.json({ success: true, message: (res.locals.settings as Settings).thankYouMessage });
      return;
    }
    if (PublicController.isFooterContactSource(req)) {
      const returnTo = PublicController.safeReturnPath(req);
      res.redirect(303, `${returnTo}?sent=1#footer-contact`);
      return;
    }
    const contactPage = await PublicController.contactPage();
    res.redirect(303, `${contactPage?.url ?? '/'}?sent=1#contact-form`);
  }

  public static async submitFeedback(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(feedbackFormSchema, req.body);
    if (!parsed.ok) {
      await PublicController.respondWithErrors(req, res, parsed.fields, 'feedback');
      return;
    }
    try {
      captchaService.verify(parsed.data.captcha, 'feedback', req.ip ?? '');
      await contactService.submitFeedback(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' });
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await PublicController.respondWithErrors(req, res, error.fields, 'feedback');
        return;
      }
      throw error;
    }
    if (wantsJson(req)) {
      res.json({ success: true, message: (res.locals.settings as Settings).thankYouMessage });
      return;
    }
    const feedbackPage = await PublicController.feedbackPage();
    res.redirect(303, `${feedbackPage?.url ?? '/feedback'}?sent=1#feedback-form`);
  }

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const pages = (await pagesService.getPublishedTree()).flatMap(function flat(node): PageNode[] {
      return [node, ...node.children.flatMap(flat)];
    });
    const [albums, videos] = await Promise.all([albumsService.listPublished(), videosService.listPublished()]);
    const urls = [
      ...new Set(['/', ...pages.map((page) => page.url), ...albums.map((album) => albumsService.url(album)), ...videos.map((video) => videosService.url(video))])
    ];
    const body = urls.map((url) => `  <url><loc>${baseUrl}${url === '/' ? '/' : url}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static async renderHome(res: Response, contactForm: ContactFormState): Promise<void> {
    const home = await homeService.get();
    const [news, albums, videos, aboutPage] = await Promise.all([
      pagesService.getNewsOverview(),
      albumsService.listPublished(),
      videosService.listPublished(),
      pagesService.findPublishedByKey('about-us')
    ]);
    const posts = news.entries
      .filter((entry) => entry.status === 'published')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, home.latestPosts.limit);
    const settings = res.locals.settings as Settings;
    const seo = res.locals.seo as Record<string, string>;
    const firstSlide = home.hero.slides[0];
    res.locals.seo = {
      ...seo,
      title: settings.seo.defaultTitle || settings.siteName,
      description: settings.seo.defaultDescription || settings.description || seo.description,
      image: firstSlide?.image || settings.seo.defaultImage || seo.image
    };
    res.render('home', {
      home,
      posts,
      albums: albums.slice(0, 4),
      videos,
      aboutUrl: aboutPage?.url ?? '/about-us',
      bodyClass: 'home',
      contactForm
    });
  }

  private static async respondWithErrors(req: Request, res: Response, fields: Record<string, string>, kind: 'contact' | 'feedback'): Promise<void> {
    const message = 'Please correct the highlighted fields.';
    if (wantsJson(req)) {
      res.status(422).json({ success: false, message, fields });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const key of ['name', 'email', 'company', 'phone', 'topic', 'message']) {
      const value = body[key];
      values[key] = typeof value === 'string' ? value : '';
    }
    res.status(422);
    const state = { values, errors: fields, sent: false, message };
    if (kind === 'contact' && PublicController.isFooterContactSource(req)) {
      await PublicController.renderReturnPath(res, PublicController.safeReturnPath(req), state);
      return;
    }
    const page = kind === 'feedback' ? await PublicController.feedbackPage() : await PublicController.contactPage();
    if (page) {
      await PublicController.renderPage(res, page, state);
      return;
    }
    await PublicController.renderHome(res, state);
  }

  private static isFooterContactSource(req: Request): boolean {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const source = typeof body.source === 'string' ? body.source.trim().toLowerCase() : '';
    return source === 'footer' || source === 'home';
  }

  private static safeReturnPath(req: Request): string {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = typeof body.returnTo === 'string' ? body.returnTo.trim() : '';
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !raw.includes('://')) {
      return raw.split('?')[0]?.split('#')[0] || '/';
    }
    return '/';
  }

  private static async renderReturnPath(res: Response, path: string, contactForm: ContactFormState): Promise<void> {
    if (path === '/') {
      await PublicController.renderHome(res, contactForm);
      return;
    }
    const page = await pagesService.findPublishedByPath(path);
    if (page) {
      await PublicController.renderPage(res, page, contactForm);
      return;
    }
    await PublicController.renderHome(res, contactForm);
  }

  private static async contactPage(): Promise<PageNode | null> {
    const config = await loadTransformConfig();
    return pagesService.findPublishedByKey(config.legacy.contactPageKey);
  }

  private static async feedbackPage(): Promise<PageNode | null> {
    const config = await loadTransformConfig();
    return pagesService.findPublishedByKey(config.legacy.feedbackPageKey ?? 'feedback');
  }

  private static async renderPage(res: Response, page: PageNode, contactForm: ContactFormState): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [sectionRoot, gallery, newsRoot, albums, videos] = await Promise.all([
      pagesService.getSectionRoot(published),
      pagesService.getPageImages(published.id),
      pagesService.getNewsRoot(),
      published.key === 'photos' ? albumsService.listPublished() : Promise.resolve([]),
      published.key === 'videos' ? videosService.listPublished() : Promise.resolve([])
    ]);
    const isStory = pagesService.isNewsStory(published, newsRoot);
    pageSeo(res, published, isStory ? 'article' : 'website');
    const view = published.kind === 'contact'
      ? 'contact'
      : isStory
        ? 'news-post'
        : published.kind === 'news'
          ? 'news-index'
          : published.key === 'photos'
            ? 'albums-index'
            : published.key === 'videos'
              ? 'videos-index'
              : published.kind === 'section' || (published.content.trim() === '' && published.children.length > 0)
                ? 'section'
                : 'page';
    const posts = view === 'news-index'
      ? (newsRoot?.children ?? []).filter((entry) => entry.status === 'published').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
    res.render(view, {
      page: published,
      sectionRoot,
      gallery,
      albums,
      videos,
      posts,
      contactForm,
      bodyClass: view === 'contact' ? 'contact' : view === 'news-post' ? 'newsdetails' : `inside ${published.key}`
    });
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
