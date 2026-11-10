import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CollectionKind, Settings } from '../domain/models.js';
import { NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { collectionService, toEntryCard } from '../services/collectionService.js';
import { homeService } from '../services/homeService.js';
import { isCollectionKind, pagesService, type PageNode } from '../services/pagesService.js';
import { excerpt } from '../services/sanitizeService.js';
import { socialService, type SocialLink } from '../services/socialService.js';
import { videoService } from '../services/videoService.js';

const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional()
});

function absolute(baseUrl: string, url: string): string {
  return /^https?:/.test(url) ? url : `${baseUrl}${url}`;
}

/** JSON for a <script type="application/ld+json"> block; "<" is escaped so content cannot close the tag. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
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
    const home = await homeService.get();
    const [upcoming, videos, events, news, social, videosPage] = await Promise.all([
      collectionService.upcoming(home.upcoming.count),
      videoService.listPublic(home.videos.count),
      collectionService.latest('events', home.events.count, home.upcoming.enabled),
      collectionService.latest('news', home.news.count),
      socialService.get(),
      pagesService.findPublishedByKind('videos')
    ]);
    const settings = res.locals.settings as Settings;
    const baseUrl = resolveBaseUrl(req);
    const socialLinks = res.locals.socialLinks as SocialLink[];
    const heroImage = home.hero.slides.find((slide) => slide.image)?.image ?? '';
    res.render('home', {
      home,
      upcoming,
      videos,
      videosUrl: videosPage?.url ?? null,
      events,
      news,
      instagram: social.instagram.enabled ? { ...social.instagram, embeds: socialService.instagramEmbeds(social), profile: social.profiles.instagram ?? '' } : null,
      facebook: socialService.facebookTimeline(social) ? { ...social.facebook, src: socialService.facebookTimeline(social), profile: social.profiles.facebook ?? '' } : null,
      bodyClass: 'is-home',
      jsonLd: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: settings.siteName,
        jobTitle: 'Singer',
        description: settings.seo.defaultDescription || settings.description,
        url: `${baseUrl}/`,
        image: heroImage ? absolute(baseUrl, heroImage) : undefined,
        sameAs: socialLinks.map((link) => link.url)
      })
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
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      res.redirect(301, `${page.url}${query}`);
      return;
    }
    if (isCollectionKind(page.kind)) {
      PublicController.renderListing(req, res, page, page.kind);
      return;
    }
    if (page.kind === 'videos') {
      await PublicController.renderVideos(res, page);
      return;
    }
    const parent = page.parentId === null ? null : await pagesService.getById(page.parentId);
    if (parent && isCollectionKind(parent.kind) && parent.status === 'published') {
      await PublicController.renderEntry(req, res, page, parent.kind);
      return;
    }
    await PublicController.renderPage(res, page);
  }

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const pages = (await pagesService.getPublishedTree()).flatMap(function flat(node): PageNode[] {
      return [node, ...node.children.flatMap(flat)];
    });
    const urls = [...new Set(['/', ...pages.map((page) => page.url)])];
    const body = urls.map((url) => `  <url><loc>${baseUrl}${url === '/' ? '/' : encodeURI(url)}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static async renderPage(res: Response, page: PageNode): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const gallery = await pagesService.getPageImages(published.id);
    pageSeo(res, published);
    res.render('page', {
      page: published,
      gallery,
      breadcrumbs: [{ title: 'Home', url: '/' }, ...published.ancestors, { title: published.title, url: published.url }],
      bodyClass: 'is-page'
    });
  }

  private static renderListing(req: Request, res: Response, root: PageNode, kind: CollectionKind): void {
    const query = listingQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new NotFoundError('That page number does not exist.');
    }
    const requested = query.data.page ?? 1;
    const listing = collectionService.listing(root, kind, requested);
    if (!listing) {
      throw new NotFoundError('That page number does not exist.');
    }
    pageSeo(res, root);
    const seo = res.locals.seo as Record<string, string>;
    if (requested > 1) {
      res.locals.seo = { ...seo, title: `${seo.title} (page ${requested})`, canonical: `${seo.canonical}?page=${requested}` };
    }
    res.render('collection', { root, listing, kind, bodyClass: `is-collection is-${kind}` });
  }

  private static async renderEntry(req: Request, res: Response, page: PageNode, kind: CollectionKind): Promise<void> {
    const root = await collectionService.findRoot(kind);
    if (!root) {
      throw new NotFoundError(`No page exists at ${req.path}.`);
    }
    const published = await pagesService.inheritHeroForPublish(page);
    const gallery = await pagesService.getPageImages(published.id);
    const card = toEntryCard(published, kind);
    pageSeo(res, published, 'article');
    const settings = res.locals.settings as Settings;
    const baseUrl = resolveBaseUrl(req);
    const image = published.heroImage ? absolute(baseUrl, published.heroImage) : undefined;
    const structured =
      kind === 'events' && published.eventDate
        ? {
            '@context': 'https://schema.org',
            '@type': 'MusicEvent',
            name: published.title,
            startDate: published.eventDate,
            eventStatus: 'https://schema.org/EventScheduled',
            location: published.venue ? { '@type': 'Place', name: published.venue, address: published.venue } : undefined,
            image,
            description: (res.locals.seo as Record<string, string>).description,
            performer: { '@type': 'Person', name: settings.siteName },
            url: `${baseUrl}${published.url}`
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: published.title.slice(0, 110),
            datePublished: published.createdAt,
            dateModified: published.updatedAt,
            image: image ? [image] : undefined,
            author: { '@type': 'Person', name: settings.siteName },
            mainEntityOfPage: `${baseUrl}${published.url}`
          };
    res.render('entry', {
      page: published,
      poster: page.heroImage,
      card,
      kind,
      root,
      gallery,
      neighbours: collectionService.neighbours(root, kind, published),
      bodyClass: `is-entry is-${kind}-entry`,
      jsonLd: jsonLd(structured)
    });
  }

  private static async renderVideos(res: Response, page: PageNode): Promise<void> {
    const videos = await videoService.listPublic();
    const social = await socialService.get();
    pageSeo(res, page);
    res.render('videos', { page, videos, channelUrl: social.profiles.youtube ?? '', bodyClass: 'is-videos' });
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
