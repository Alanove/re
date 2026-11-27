import type { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '../config/paths.js';
import { loadTransformConfig } from '../config/transform.js';
import type { AlbumSection, Settings } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { safeParseFields } from '../middleware/validate.js';
import { contactFormSchema, feedbackFormSchema } from '../schemas/publicSchemas.js';
import { albumsService } from '../services/albumsService.js';
import { captchaService } from '../services/captchaService.js';
import { contactService } from '../services/contactService.js';
import { homeService } from '../services/homeService.js';
import { pagesService, type PageNode } from '../services/pagesService.js';
import { excerpt } from '../services/sanitizeService.js';

interface ContactFormState {
  values: Record<string, string>;
  errors: Record<string, string>;
  sent: boolean;
  message: string;
}

interface ArchiveMonth {
  number: number;
  label: string;
}

interface ArchiveYear {
  year: number;
  months: ArchiveMonth[];
}

function emptyForm(sent = false): ContactFormState {
  return { values: {}, errors: {}, sent, message: '' };
}

/** Live treats these as leaf links in nav/sidebar; children are listed on the page itself. */
const CHILD_LISTING_KEYS = new Set(['projets-periscolaires-et-sociaux', 'communaute-religieuse']);
const CHILD_LISTING_PAGE_SIZE = 10;

/** Brochure tree for the site map. News stories stay off the list; Actualités itself stays. */
function brochurePages(nodes: PageNode[]): PageNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.kind === 'news' || node.key === 'actualites' ? [] : brochurePages(node.children)
  }));
}

/** Sidebar tree: listing hubs stay leaves so their children are not nested in the menu. */
function sidebarPages(nodes: PageNode[]): PageNode[] {
  return nodes.map((node) => ({
    ...node,
    children: CHILD_LISTING_KEYS.has(node.key) ? [] : sidebarPages(node.children)
  }));
}

function findNodeById(nodes: PageNode[], id: number): PageNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const nested = findNodeById(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function childListingEntries(children: PageNode[]): PageNode[] {
  return [...children]
    .filter((child) => child.status === 'published')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((child) => ({
      ...child,
      summary: child.summary?.trim() || excerpt(child.content, 140)
    }));
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

function monthLabel(month: number): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(Date.UTC(2020, month - 1, 1)));
}

function buildArchive(entries: PageNode[]): ArchiveYear[] {
  const byYear = new Map<number, Set<number>>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const months = byYear.get(year) ?? new Set<number>();
    months.add(month);
    byYear.set(year, months);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: [...months]
        .sort((a, b) => b - a)
        .map((number) => ({ number, label: monthLabel(number) }))
    }));
}

function filterByArchive(entries: PageNode[], year?: number, month?: number): PageNode[] {
  return entries.filter((entry) => {
    const date = new Date(entry.createdAt);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    if (year !== undefined && date.getUTCFullYear() !== year) {
      return false;
    }
    if (month !== undefined && date.getUTCMonth() + 1 !== month) {
      return false;
    }
    return true;
  });
}

export class PublicController {
  public static async home(req: Request, res: Response): Promise<void> {
    await PublicController.renderHome(res, emptyForm(req.query.sent === '1'));
  }

  public static async album(req: Request, res: Response): Promise<void> {
    const section = String(req.params.section ?? '') as AlbumSection;
    if (section !== 'nos-albums' && section !== 'visite-virtuelle') {
      throw new NotFoundError('Photo album not found.');
    }
    const key = String(req.params.albumKey ?? '');
    const album = await albumsService.findPublishedByKey(key, section);
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
    res.render('album', {
      album: { ...album, url: albumsService.url(album) },
      marqueeHtml: await PublicController.marqueeHtml(),
      bodyClass: 'inside photos'
    });
  }

  public static async newsArchive(req: Request, res: Response): Promise<void> {
    const year = Number.parseInt(String(req.params.year ?? ''), 10);
    const monthRaw = req.params.month ? Number.parseInt(String(req.params.month), 10) : undefined;
    if (!Number.isInteger(year) || year < 1990 || year > 2100 || String(year) !== String(req.params.year)) {
      await PublicController.page(req, res);
      return;
    }
    if (monthRaw !== undefined && (!Number.isInteger(monthRaw) || monthRaw < 1 || monthRaw > 12)) {
      throw new NotFoundError('Archive not found.');
    }
    const news = await pagesService.getNewsOverview();
    if (!news.root) {
      throw new NotFoundError('Actualités not found.');
    }
    const published = news.entries.filter((entry) => entry.status === 'published');
    const posts = filterByArchive(published, year, monthRaw).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const title = monthRaw ? `${monthLabel(monthRaw)} ${year}` : `Année ${year}`;
    const page = await pagesService.inheritHeroForPublish(news.root);
    pageSeo(res, { ...page, title, header: title, seo: { ...page.seo, title } }, 'website');
    res.render('news-index', {
      page: { ...page, title, header: title },
      sectionRoot: page,
      gallery: [],
      posts,
      latestNews: published.slice(0, 5),
      archiveYears: [],
      marqueeHtml: await PublicController.marqueeHtml(),
      contactForm: emptyForm(),
      bodyClass: 'inside actualites'
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
    const rawListPage = typeof req.query.p === 'string' ? req.query.p : '1';
    const listPage = Math.max(1, Number.parseInt(rawListPage, 10) || 1);
    await PublicController.renderPage(res, page, emptyForm(req.query.sent === '1'), listPage);
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
    const contactPage = await PublicController.contactPage();
    res.redirect(303, `${contactPage?.url ?? '/'}?sent=1`);
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
    res.redirect(303, '/?sent=1');
  }

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const pages = (await pagesService.getPublishedTree()).flatMap(function flat(node): PageNode[] {
      return [node, ...node.children.flatMap(flat)];
    });
    const albums = await albumsService.listPublished();
    const urls = [...new Set(['/', ...pages.map((page) => page.url), ...albums.map((album) => albumsService.url(album))])];
    const body = urls.map((url) => `  <url><loc>${baseUrl}${url === '/' ? '/' : url}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static async marqueeHtml(): Promise<string> {
    const home = await homeService.get();
    if (home.marquee) {
      return home.marquee;
    }
    try {
      return await readFile(path.join(PATHS.root, 'wwwroot', 'prv', 'StaticContent', 'marquee.htm'), 'utf8');
    } catch {
      return '';
    }
  }

  private static async renderHome(res: Response, contactForm: ContactFormState): Promise<void> {
    const home = await homeService.get();
    const news = await pagesService.getNewsOverview();
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
      bodyClass: 'home',
      contactForm
    });
  }

  private static async respondWithErrors(req: Request, res: Response, fields: Record<string, string>, kind: 'contact' | 'feedback'): Promise<void> {
    const message = 'Veuillez corriger les champs indiqués.';
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
    if (kind === 'contact') {
      const page = await PublicController.contactPage();
      if (page) {
        await PublicController.renderPage(res, page, state);
        return;
      }
    }
    await PublicController.renderHome(res, state);
  }

  private static async contactPage(): Promise<PageNode | null> {
    const config = await loadTransformConfig();
    return pagesService.findPublishedByKey(config.legacy.contactPageKey);
  }

  private static async renderPage(
    res: Response,
    page: PageNode,
    contactForm: ContactFormState,
    listPage = 1
  ): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [sectionRoot, gallery, newsRoot] = await Promise.all([
      pagesService.getSectionRoot(published),
      pagesService.getPageImages(published.id),
      pagesService.getNewsRoot()
    ]);
    const isStory = pagesService.isNewsStory(published, newsRoot);
    const albumSection: AlbumSection | null =
      published.key === 'nos-albums' || published.key === 'visite-virtuelle' ? published.key : null;
    const albums = albumSection
      ? (await albumsService.listPublishedBySection(albumSection)).map((album) => ({ ...album, url: albumsService.url(album) }))
      : [];
    pageSeo(res, published, isStory ? 'article' : 'website');
    const publishedNews = (newsRoot?.children ?? [])
      .filter((entry) => entry.status === 'published')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const listingParent =
      published.parentId !== null ? findNodeById([sectionRoot], published.parentId) : null;
    const isListingHub = CHILD_LISTING_KEYS.has(published.key);
    const isListingChild = Boolean(listingParent && CHILD_LISTING_KEYS.has(listingParent.key));
    const listingEntries = isListingHub ? childListingEntries(published.children) : [];
    const listingPages = Math.max(1, Math.ceil(listingEntries.length / CHILD_LISTING_PAGE_SIZE));
    const currentListPage = Math.min(listPage, listingPages);
    const childPosts = listingEntries.slice(
      (currentListPage - 1) * CHILD_LISTING_PAGE_SIZE,
      currentListPage * CHILD_LISTING_PAGE_SIZE
    );

    const view = published.kind === 'contact'
      ? 'contact'
      : isStory
        ? 'news-post'
        : published.kind === 'news'
          ? 'news-index'
          : albumSection
            ? 'albums-index'
            : published.kind === 'section' || (published.content.trim() === '' && published.children.length > 0)
              ? 'section'
              : 'page';
    res.render(view, {
      page: published,
      sectionRoot: {
        ...sectionRoot,
        children: sidebarPages(sectionRoot.children)
      },
      sideTitle: isListingChild && listingParent ? listingParent.title : undefined,
      sideItems: isListingChild && listingParent ? listingParent.children : undefined,
      listingParent: isListingChild ? listingParent : null,
      childPosts,
      childListPage: currentListPage,
      childListPages: listingPages,
      sitemapTree: published.key === 'site-map' ? brochurePages(await pagesService.getPublishedTree()) : [],
      gallery,
      albums,
      posts: published.kind === 'news' ? publishedNews : [],
      latestNews: publishedNews.slice(0, 5),
      archiveYears: published.kind === 'news' ? buildArchive(publishedNews) : [],
      marqueeHtml: await PublicController.marqueeHtml(),
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
