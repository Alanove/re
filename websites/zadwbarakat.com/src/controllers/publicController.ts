import type { Request, Response } from 'express';
import type { Album, Section, Settings, Video } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { guessLatinLanguage, relaxOpposingDirections } from '../lib/arabicNormalize.js';
import { decodeRequestPath, encodePath } from '../lib/paths.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { safeParseFields } from '../middleware/validate.js';
import { contactFormSchema, contactQuerySchema, hymnsQuerySchema, libraryQuerySchema, listingQuerySchema, newsletterFormSchema } from '../schemas/publicSchemas.js';
import { albumsService } from '../services/albumsService.js';
import { articlesService, articleUrl, effectiveDirection } from '../services/articlesService.js';
import { contactService } from '../services/contactService.js';
import { formatDate } from '../services/format.js';
import { homeService } from '../services/homeService.js';
import { hymnsService } from '../services/hymnsService.js';
import { libraryService } from '../services/libraryService.js';
import { menuService } from '../services/menuService.js';
import { newsletterService } from '../services/newsletterService.js';
import { pageCacheService } from '../services/pageCacheService.js';
import { pagesService, type PageNode } from '../services/pagesService.js';
import { purchasesService } from '../services/purchasesService.js';
import { excerpt, toPlainText } from '../services/sanitizeService.js';
import { searchService } from '../services/searchService.js';
import { sectionsService } from '../services/sectionsService.js';
import { videoPoster, videosService } from '../services/videosService.js';

interface FormState {
  values: Record<string, string>;
  errors: Record<string, string>;
  sent: boolean;
  message: string;
}

interface Crumb {
  title: string;
  url: string;
}

const HOME_CRUMB: Crumb = { title: 'الرئيسية', url: '/' };
const CONTACT_FIELDS = ['name', 'email', 'phone', 'topic', 'message', 'purchaseId'];
const INVALID_FORM = 'يرجى تصحيح الحقول المشار إليها.';

function emptyForm(sent = false): FormState {
  return { values: {}, errors: {}, sent, message: '' };
}

function wantsJson(req: Request): boolean {
  return (req.get('accept') ?? '').includes('application/json');
}

function bodyValues(req: Request, fields: string[]): Record<string, string> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((key) => [key, typeof body[key] === 'string' ? body[key] : '']));
}

function absolute(baseUrl: string, url: string): string {
  return /^https?:/.test(url) ? url : `${baseUrl}${encodePath(url)}`;
}

/** JSON for a <script type="application/ld+json"> block; "<" is escaped so content cannot close the tag. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function setSeo(res: Response, values: { title: string; description?: string; keywords?: string; image?: string; type?: string; canonical?: string }): void {
  const settings = res.locals.settings as Settings;
  const seo = res.locals.seo as Record<string, string>;
  res.locals.seo = {
    ...seo,
    title: values.title === settings.siteName ? values.title : `${values.title} | ${settings.siteName}`,
    description: values.description || seo.description,
    keywords: values.keywords || seo.keywords,
    image: values.image || seo.image,
    type: values.type ?? 'website',
    canonical: values.canonical ?? seo.canonical
  };
}

function setDirection(res: Response, direction: 'rtl' | 'ltr', sample: string): void {
  res.locals.contentDir = direction;
  res.locals.contentLang = direction === 'ltr' ? guessLatinLanguage(sample) : 'ar';
}

function pageCrumbs(page: PageNode): Crumb[] {
  return [HOME_CRUMB, ...page.ancestors.map((item) => ({ title: item.title, url: item.url })), { title: page.title, url: page.url }];
}

function parentPath(sitePath: string): { parent: string; slug: string } | null {
  const index = sitePath.lastIndexOf('/');
  if (index <= 0) {
    return null;
  }
  return { parent: sitePath.slice(0, index), slug: sitePath.slice(index + 1) };
}

/** Renders a view to HTML once and serves it from memory until content changes (anonymous GETs only). */
async function renderCached(req: Request, res: Response, view: string, locals: () => Promise<Record<string, unknown>>): Promise<void> {
  const cacheable = req.method === 'GET' && !req.session.userId && !res.locals.noCache;
  const key = `${view}:${req.originalUrl}`;
  const cached = cacheable ? pageCacheService.get(key) : null;
  if (cached !== null) {
    res.type('html').send(cached);
    return;
  }
  const data = await locals();
  const html = await new Promise<string>((resolve, reject) => {
    res.render(view, data, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
  if (cacheable && res.statusCode === 200) {
    pageCacheService.set(key, html);
  }
  res.type('html').send(html);
}

export class PublicController {
  public static async home(req: Request, res: Response): Promise<void> {
    await renderCached(req, res, 'home', async () => {
      const home = await homeService.get();
      const sections = await sectionsService.byId();
      const publishedSection = (id: number | null): Section | null => {
        const section = id === null ? undefined : sections.get(id);
        return section && section.status === 'published' ? section : null;
      };
      const spotlightSection = publishedSection(home.spotlight.sectionId);
      const questionsSection = publishedSection(home.questions.sectionId);
      const [spotlight, questions, sectionGrid, hymns, hymnsPage, videos, videosPage, albums, albumsPage] = await Promise.all([
        home.spotlight.enabled ? articlesService.latest(spotlightSection?.id ?? null, home.spotlight.count) : Promise.resolve([]),
        home.questions.enabled && questionsSection ? articlesService.latest(questionsSection.id, home.questions.count) : Promise.resolve([]),
        home.sections.enabled
          ? Promise.all(
              home.sections.sectionIds
                .map((id) => publishedSection(id))
                .filter((section): section is Section => section !== null)
                .map(async (section) => ({ section, cards: await articlesService.latest(section.id, home.sections.count) }))
            )
          : Promise.resolve([]),
        home.hymns.enabled ? hymnsService.latest(home.hymns.count) : Promise.resolve([]),
        pagesService.findPublishedByKind('hymns'),
        home.videos.enabled ? videosService.listPublished() : Promise.resolve([]),
        pagesService.findPublishedByKind('videos'),
        home.albums.enabled ? albumsService.listPublished() : Promise.resolve([]),
        pagesService.findPublishedByKind('albums')
      ]);
      const settings = res.locals.settings as Settings;
      const baseUrl = resolveBaseUrl(req);
      return {
        home,
        spotlight,
        spotlightSection,
        questions,
        questionsSection,
        sectionGrid: sectionGrid.filter((entry) => entry.cards.length > 0),
        hymns: hymnsPage ? hymns : [],
        hymnsUrl: hymnsPage?.url ?? null,
        videos: videosPage ? videos.slice(0, home.videos.count).map((video) => PublicController.videoCard(video, videosPage.url)) : [],
        videosUrl: videosPage?.url ?? null,
        albums: albumsPage ? albums.slice(0, home.albums.count).map((album) => PublicController.albumCard(album, albumsPage.url)) : [],
        albumsUrl: albumsPage?.url ?? null,
        bodyClass: 'is-home',
        jsonLd: jsonLd({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: settings.siteName,
          description: settings.seo.defaultDescription || settings.description,
          url: `${baseUrl}/`,
          logo: settings.logo ? absolute(baseUrl, settings.logo) : undefined,
          email: settings.contactEmail || undefined,
          sameAs: [...Object.values(settings.social), ...settings.relatedLinks.map((link) => link.url)].filter((url) => /^https?:/.test(url))
        })
      };
    });
  }

  public static async resolve(req: Request, res: Response): Promise<void> {
    const sitePath = decodeRequestPath(req.path);
    if (req.path !== '/' && req.path.endsWith('/')) {
      res.redirect(301, `${encodePath(sitePath)}${PublicController.queryString(req)}`);
      return;
    }

    const page = await pagesService.findPublishedByPath(sitePath);
    if (page) {
      await PublicController.renderPageKind(req, res, page);
      return;
    }

    const section = await sectionsService.findPublishedByPath(sitePath);
    if (section) {
      await PublicController.renderSection(req, res, section);
      return;
    }

    const split = parentPath(sitePath);
    if (split) {
      const parentSection = await sectionsService.findPublishedByPath(split.parent);
      if (parentSection && (await PublicController.renderArticle(req, res, parentSection, split.slug))) {
        return;
      }
      const parentPage = await pagesService.findPublishedByPath(split.parent);
      if (parentPage && (await PublicController.renderModuleItem(req, res, parentPage, split.slug))) {
        return;
      }
    }
    throw new NotFoundError(`No page exists at ${sitePath}.`);
  }

  public static async submitContact(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(contactFormSchema, req.body);
    if (!parsed.ok) {
      await PublicController.contactErrors(req, res, parsed.fields);
      return;
    }
    try {
      await contactService.submit(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' });
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await PublicController.contactErrors(req, res, error.fields);
        return;
      }
      throw error;
    }
    if (wantsJson(req)) {
      res.json({ success: true, message: (res.locals.settings as Settings).thankYouMessage });
      return;
    }
    res.redirect(303, `${encodePath(res.locals.contactUrl as string)}?sent=1#contact-form`);
  }

  public static async subscribe(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(newsletterFormSchema, req.body);
    const settings = res.locals.settings as Settings;
    if (!parsed.ok) {
      if (wantsJson(req)) {
        res.status(422).json({ success: false, message: parsed.fields.email ?? INVALID_FORM, fields: parsed.fields });
        return;
      }
      res.redirect(303, '/?newsletter=invalid#newsletter');
      return;
    }
    if (!parsed.data.website) {
      await newsletterService.subscribe(parsed.data.email, req.ip ?? '');
    }
    if (wantsJson(req)) {
      res.json({ success: true, message: settings.newsletterThankYou });
      return;
    }
    res.redirect(303, '/?newsletter=1#newsletter');
  }

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const [pages, sections, articles, albumsPage, albums, videosPage, videos, purchasesPage, purchases] = await Promise.all([
      pagesService.getPublishedFlat(),
      sectionsService.listPublished(),
      articlesService.publishedNewestFirst(),
      pagesService.findPublishedByKind('albums'),
      albumsService.listPublished(),
      pagesService.findPublishedByKind('videos'),
      videosService.listPublished(),
      pagesService.findPublishedByKind('purchases'),
      purchasesService.list()
    ]);
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const entries: { url: string; lastmod?: string }[] = [
      { url: '/' },
      ...pages.map((page) => ({ url: page.url, lastmod: page.updatedAt })),
      ...sections.map((section) => ({ url: section.path })),
      ...articles.flatMap((article) => {
        const section = sectionById.get(article.sectionId);
        return section ? [{ url: articleUrl(article, section), lastmod: article.updatedAt }] : [];
      }),
      ...(albumsPage ? albums.map((album) => ({ url: `${albumsPage.url}/${album.slug}`, lastmod: album.updatedAt })) : []),
      ...(videosPage ? videos.map((video) => ({ url: `${videosPage.url}/${video.slug}`, lastmod: video.updatedAt })) : []),
      ...(purchasesPage ? purchases.filter((item) => item.status === 'published').map((item) => ({ url: `${purchasesPage.url}/${item.slug}`, lastmod: item.updatedAt })) : [])
    ];
    const seen = new Set<string>();
    const body = entries
      .filter((entry) => !seen.has(entry.url) && seen.add(entry.url))
      .map((entry) => `  <url><loc>${baseUrl}${entry.url === '/' ? '/' : encodePath(entry.url)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
      .join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /search\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static queryString(req: Request): string {
    return req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  }

  private static listingPage(req: Request): number {
    const query = listingQuerySchema.parse(req.query);
    return query.p;
  }

  private static async renderPageKind(req: Request, res: Response, page: PageNode): Promise<void> {
    switch (page.kind) {
      case 'contact': {
        const query = contactQuerySchema.parse(req.query);
        const state = emptyForm(query.sent === '1');
        if (query.item) {
          state.values.purchaseId = String(query.item);
        }
        await PublicController.renderContact(res, page, state);
        return;
      }
      case 'library':
        await PublicController.renderLibrary(req, res, page);
        return;
      case 'hymns':
        await PublicController.renderHymns(req, res, page);
        return;
      case 'albums':
        await PublicController.renderAlbums(res, page);
        return;
      case 'videos':
        await PublicController.renderVideos(res, page);
        return;
      case 'purchases':
        await PublicController.renderPurchases(res, page);
        return;
      default:
        await PublicController.renderPage(req, res, page);
    }
  }

  private static async renderPage(req: Request, res: Response, page: PageNode): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [sectionRoot, gallery, sections] = await Promise.all([
      pagesService.getSectionRoot(published),
      pagesService.getPageImages(published.id),
      sectionsService.listPublished()
    ]);
    const sample = `${published.title} ${toPlainText(published.content).slice(0, 2000)}`;
    const direction = effectiveDirection(published.direction, sample);
    setDirection(res, direction, sample);
    setSeo(res, {
      title: published.seo.title || published.title,
      description: published.seo.description || published.summary || excerpt(published.content, 160),
      keywords: published.seo.keywords,
      image: published.heroImage
    });
    const linkedUrls = await menuService.childUrls('main', published.url);
    const sectionByPath = new Map(sections.map((section) => [section.path, section]));
    const childSections = [
      ...linkedUrls.flatMap((url) => sectionByPath.get(url) ?? []),
      ...sections.filter((section) => section.path.startsWith(`${published.url}/`) && !section.path.slice(published.url.length + 1).includes('/'))
    ].filter((section, index, all) => all.findIndex((other) => other.id === section.id) === index);
    const linkedPages = (await Promise.all(linkedUrls.filter((url) => !sectionByPath.has(url)).map((url) => pagesService.findPublishedByPath(url)))).filter(
      (child): child is PageNode => child !== null && child.id !== published.id
    );
    const childPages = [...published.children, ...linkedPages].filter((child, index, all) => all.findIndex((other) => other.id === child.id) === index);
    const isHub = published.kind === 'section' || (published.content.trim() === '' && (childPages.length > 0 || childSections.length > 0));
    await renderCached(req, res, isHub ? 'section' : 'page', () =>
      Promise.resolve({
        page: { ...published, content: relaxOpposingDirections(published.content, direction) },
        sectionRoot,
        gallery,
        childSections,
        childPages,
        breadcrumbs: pageCrumbs(published),
        bodyClass: isHub ? 'is-hub' : 'is-page'
      })
    );
  }

  private static async renderSection(req: Request, res: Response, section: Section): Promise<void> {
    const page = PublicController.listingPage(req);
    const listing = await articlesService.sectionListing(section, page);
    if (!listing) {
      throw new NotFoundError('That page number does not exist.');
    }
    const parent = parentPath(section.path);
    const parentPage = parent ? await pagesService.findPublishedByPath(parent.parent) : null;
    const siblings = (await sectionsService.listPublished()).filter((entry) => parent && entry.path.startsWith(`${parent.parent}/`) && entry.id !== section.id);
    setSeo(res, {
      title: `${section.seo.title || section.title}${page > 1 ? ` (صفحة ${page})` : ''}`,
      description: section.seo.description || section.intro,
      keywords: section.seo.keywords,
      image: section.image,
      canonical: `${resolveBaseUrl(req)}${encodePath(section.path)}${page > 1 ? `?p=${page}` : ''}`
    });
    await renderCached(req, res, 'articles', () =>
      Promise.resolve({
        section,
        listing,
        parentPage,
        siblings,
        breadcrumbs: [HOME_CRUMB, ...(parentPage ? pageCrumbs(parentPage).slice(1) : []), { title: section.title, url: section.path }],
        bodyClass: 'is-articles'
      })
    );
  }

  private static async renderArticle(req: Request, res: Response, section: Section, slug: string): Promise<boolean> {
    const view = await articlesService.view(section, slug, (article) => searchService.relatedArticleIds(article));
    if (!view) {
      return false;
    }
    const { article } = view;
    const baseUrl = resolveBaseUrl(req);
    const parent = parentPath(section.path);
    const parentPage = parent ? await pagesService.findPublishedByPath(parent.parent) : null;
    setDirection(res, view.direction, `${article.title} ${toPlainText(article.content).slice(0, 2000)}`);
    setSeo(res, {
      title: article.seo.title || article.title,
      description: article.seo.description || article.summary || excerpt(article.content, 160),
      keywords: article.seo.keywords || article.tags.join(', '),
      image: article.image?.src,
      type: 'article'
    });
    const settings = res.locals.settings as Settings;
    res.render('article', {
      view,
      breadcrumbs: [HOME_CRUMB, ...(parentPage ? pageCrumbs(parentPage).slice(1) : []), { title: section.title, url: section.path }, { title: article.title, url: view.url }],
      bodyClass: 'is-article',
      jsonLd: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title.slice(0, 110),
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: res.locals.contentLang as string,
        image: article.image ? [absolute(baseUrl, article.image.src)] : undefined,
        keywords: article.tags.length ? article.tags.join(', ') : undefined,
        articleSection: section.title,
        author: { '@type': 'Organization', name: settings.siteName },
        publisher: { '@type': 'Organization', name: settings.siteName, logo: settings.logo ? { '@type': 'ImageObject', url: absolute(baseUrl, settings.logo) } : undefined },
        mainEntityOfPage: `${baseUrl}${encodePath(view.url)}`
      })
    });
    return true;
  }

  private static async renderModuleItem(req: Request, res: Response, page: PageNode, slug: string): Promise<boolean> {
    if (page.kind === 'albums') {
      const album = await albumsService.findPublishedBySlug(slug);
      if (!album) {
        return false;
      }
      const others = (await albumsService.listPublished()).filter((entry) => entry.id !== album.id).slice(0, 4);
      setSeo(res, { title: album.title, description: album.summary, image: album.images[0]?.src });
      res.render('album', {
        page,
        album,
        date: album.dateKnown ? formatDate(album.publishedAt) : '',
        others: others.map((entry) => PublicController.albumCard(entry, page.url)),
        breadcrumbs: [...pageCrumbs(page), { title: album.title, url: `${page.url}/${album.slug}` }],
        bodyClass: 'is-album'
      });
      return true;
    }
    if (page.kind === 'videos') {
      const video = await videosService.findPublishedBySlug(slug);
      if (!video) {
        return false;
      }
      const others = (await videosService.listPublished()).filter((entry) => entry.id !== video.id).slice(0, 6);
      setDirection(res, effectiveDirection(video.direction, `${video.title} ${video.summary}`), `${video.title} ${video.summary}`);
      setSeo(res, { title: video.title, description: video.summary, image: videoPoster(video), type: 'video.other' });
      const baseUrl = resolveBaseUrl(req);
      res.render('video', {
        page,
        video: PublicController.videoCard(video, page.url),
        others: others.map((entry) => PublicController.videoCard(entry, page.url)),
        breadcrumbs: [...pageCrumbs(page), { title: video.title, url: `${page.url}/${video.slug}` }],
        bodyClass: 'is-video',
        jsonLd: jsonLd({
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: video.title,
          description: video.summary || video.title,
          thumbnailUrl: [absolute(baseUrl, videoPoster(video))],
          uploadDate: video.publishedAt,
          embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}`
        })
      });
      return true;
    }
    if (page.kind === 'purchases') {
      const item = await purchasesService.findPublishedBySlug(slug);
      if (!item) {
        return false;
      }
      setSeo(res, { title: item.title, description: item.summary || excerpt(item.content, 160), image: item.image?.src });
      res.render('purchase', {
        page,
        item,
        orderUrl: `${res.locals.contactUrl as string}?item=${item.id}#contact-form`,
        breadcrumbs: [...pageCrumbs(page), { title: item.title, url: `${page.url}/${item.slug}` }],
        bodyClass: 'is-purchase'
      });
      return true;
    }
    return false;
  }

  private static async renderContact(res: Response, page: PageNode, contactForm: FormState): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const purchaseId = Number(contactForm.values.purchaseId);
    const purchase = Number.isInteger(purchaseId) && purchaseId > 0 ? await purchasesService.findPublishedById(purchaseId) : null;
    if (!purchase) {
      delete contactForm.values.purchaseId;
    }
    setSeo(res, { title: published.seo.title || published.title, description: published.seo.description || published.summary, image: published.heroImage });
    res.render('contact', {
      page: published,
      contactForm,
      purchase,
      breadcrumbs: pageCrumbs(published),
      bodyClass: 'is-contact'
    });
  }

  private static async contactErrors(req: Request, res: Response, fields: Record<string, string>): Promise<void> {
    if (wantsJson(req)) {
      res.status(422).json({ success: false, message: INVALID_FORM, fields });
      return;
    }
    const contactUrl = res.locals.contactUrl as string;
    const page = await pagesService.findPublishedByPath(contactUrl);
    if (!page) {
      throw new NotFoundError('The contact page is not published.');
    }
    res.status(422);
    await PublicController.renderContact(res, page, { values: bodyValues(req, CONTACT_FIELDS), errors: fields, sent: false, message: INVALID_FORM });
  }

  private static async renderLibrary(req: Request, res: Response, page: PageNode): Promise<void> {
    const query = libraryQuerySchema.parse(req.query);
    const result = await libraryService.browse({ q: query.q, genre: query.genre, language: query.language, author: query.author, page: query.p });
    if (!result) {
      throw new NotFoundError('That page number does not exist.');
    }
    if (query.q || query.genre || query.language || query.author) {
      res.locals.robots = 'noindex,follow';
    }
    setSeo(res, { title: page.seo.title || page.title, description: page.seo.description || page.summary, image: page.heroImage });
    res.render('library', { page, query, result, breadcrumbs: pageCrumbs(page), bodyClass: 'is-library' });
  }

  private static async renderHymns(req: Request, res: Response, page: PageNode): Promise<void> {
    const query = hymnsQuerySchema.parse(req.query);
    const result = await hymnsService.browse(query);
    if (query.q || query.category) {
      res.locals.robots = 'noindex,follow';
    }
    setSeo(res, { title: page.seo.title || page.title, description: page.seo.description || page.summary, image: page.heroImage });
    res.render('hymns', { page, query, result, breadcrumbs: pageCrumbs(page), bodyClass: 'is-hymns' });
  }

  private static async renderAlbums(res: Response, page: PageNode): Promise<void> {
    const albums = await albumsService.listPublished();
    setSeo(res, { title: page.seo.title || page.title, description: page.seo.description || page.summary, image: albums[0]?.images[0]?.src });
    res.render('albums', { page, albums: albums.map((album) => PublicController.albumCard(album, page.url)), breadcrumbs: pageCrumbs(page), bodyClass: 'is-albums' });
  }

  private static async renderVideos(res: Response, page: PageNode): Promise<void> {
    const videos = await videosService.listPublished();
    setSeo(res, { title: page.seo.title || page.title, description: page.seo.description || page.summary });
    res.render('videos', { page, videos: videos.map((video) => PublicController.videoCard(video, page.url)), breadcrumbs: pageCrumbs(page), bodyClass: 'is-videos' });
  }

  private static async renderPurchases(res: Response, page: PageNode): Promise<void> {
    const groups = await purchasesService.groupedPublished();
    setSeo(res, { title: page.seo.title || page.title, description: page.seo.description || page.summary, image: page.heroImage });
    res.render('purchases', { page, groups, breadcrumbs: pageCrumbs(page), bodyClass: 'is-purchases' });
  }

  private static albumCard(album: Album, baseUrl: string) {
    const cover = album.images[0];
    return {
      title: album.title,
      summary: album.summary,
      url: `${baseUrl}/${album.slug}`,
      cover: cover ? cover.src : '',
      coverWidth: cover?.width ?? null,
      coverHeight: cover?.height ?? null,
      count: album.images.length,
      date: album.dateKnown ? formatDate(album.publishedAt) : ''
    };
  }

  private static videoCard(video: Video, baseUrl: string) {
    return {
      title: video.title,
      summary: video.summary,
      url: `${baseUrl}/${video.slug}`,
      youtubeId: video.youtubeId,
      poster: videoPoster(video),
      date: video.dateKnown ? formatDate(video.publishedAt) : '',
      direction: effectiveDirection(video.direction, `${video.title} ${video.summary}`)
    };
  }
}
