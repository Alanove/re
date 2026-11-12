import type { Request, Response } from 'express';
import { z } from 'zod';
import { loadTransformConfig } from '../config/transform.js';
import { homeListSectionKeys, type HomeListSectionKey, type Settings } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { safeParseFields } from '../middleware/validate.js';
import { contactFormSchema, donationFormSchema, donationQuerySchema } from '../schemas/publicSchemas.js';
import { collectionService, toStoryCard } from '../services/collectionService.js';
import { contactService } from '../services/contactService.js';
import { homeService } from '../services/homeService.js';
import { pagesService, type PageNode } from '../services/pagesService.js';
import { partnersService } from '../services/partnersService.js';
import { excerpt } from '../services/sanitizeService.js';

interface FormState {
  values: Record<string, string>;
  errors: Record<string, string>;
  sent: boolean;
  message: string;
}

interface ProductRef {
  id: number;
  title: string;
}

const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional()
});

const contactQuerySchema = z.object({
  sent: z.literal('1').optional().catch(undefined),
  product: z.coerce.number().int().positive().max(9_999_999_999).optional().catch(undefined)
});

const CONTACT_FIELDS = ['name', 'email', 'company', 'phone', 'topic', 'message', 'productId'];
const DONATION_FIELDS = ['name', 'email', 'phone', 'amount', 'currency', 'frequency', 'cause', 'message'];

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
    const [news, partners, ...lists] = await Promise.all([
      home.news.enabled ? collectionService.latest(home.news.count) : Promise.resolve({ root: null, entries: [] }),
      home.partners.enabled ? partnersService.listActive() : Promise.resolve([]),
      ...homeListSectionKeys.map((key) => PublicController.homeList(home[key].enabled ? home[key].sourceKey : '', home[key].count))
    ]);
    const listByKey = Object.fromEntries(homeListSectionKeys.map((key, index) => [key, lists[index]])) as Record<HomeListSectionKey, { source: PageNode | null; cards: PageNode[] }>;
    const partnersPage = await pagesService.findPublishedByKind('partners');
    const settings = res.locals.settings as Settings;
    const baseUrl = resolveBaseUrl(req);
    res.render('home', {
      home,
      news,
      partners,
      partnersUrl: partnersPage?.url ?? null,
      lists: listByKey,
      bodyClass: 'is-home',
      jsonLd: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'NGO',
        name: settings.siteName,
        description: settings.seo.defaultDescription || settings.description,
        url: `${baseUrl}/`,
        logo: settings.logo ? absolute(baseUrl, settings.logo) : undefined,
        email: settings.contactEmail || undefined,
        sameAs: Object.values(settings.social).filter(Boolean)
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
    switch (page.kind) {
      case 'news':
        PublicController.renderListing(req, res, page);
        return;
      case 'donations': {
        const query = donationQuerySchema.parse(req.query);
        const state = emptyForm(query.sent === '1');
        if (query.amount) {
          state.values.amount = String(query.amount);
        }
        await PublicController.renderDonations(res, page, state);
        return;
      }
      case 'partners':
        await PublicController.renderPartners(res, page);
        return;
      case 'contact': {
        const query = contactQuerySchema.parse(req.query);
        const state = emptyForm(query.sent === '1');
        const product = query.product ? await PublicController.findProduct(query.product) : null;
        if (product) {
          state.values.productId = String(product.id);
        }
        await PublicController.renderPage(res, page, state, product);
        return;
      }
      default:
        break;
    }
    const parent = page.parentId === null ? null : await pagesService.getById(page.parentId);
    if (parent?.kind === 'news' && parent.status === 'published') {
      await PublicController.renderStory(req, res, page);
      return;
    }
    await PublicController.renderPage(res, page, emptyForm(), null);
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
    const contactPage = await PublicController.contactPage();
    res.redirect(303, `${contactPage?.url ?? '/'}?sent=1#contact-form`);
  }

  public static async submitDonation(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(donationFormSchema, req.body);
    if (!parsed.ok) {
      await PublicController.donationErrors(req, res, parsed.fields);
      return;
    }
    try {
      await contactService.pledge(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' });
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await PublicController.donationErrors(req, res, error.fields);
        return;
      }
      throw error;
    }
    if (wantsJson(req)) {
      res.json({ success: true, message: (res.locals.settings as Settings).donation.thankYouMessage });
      return;
    }
    const donationsPage = await pagesService.findPublishedByKind('donations');
    res.redirect(303, `${donationsPage?.url ?? '/'}?sent=1#donation-form`);
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

  private static async homeList(sourceKey: string, count: number): Promise<{ source: PageNode | null; cards: PageNode[] }> {
    if (!sourceKey) {
      return { source: null, cards: [] };
    }
    const source = await pagesService.findPublishedByKey(sourceKey);
    if (!source) {
      return { source: null, cards: [] };
    }
    const withHero = await pagesService.inheritHeroForPublish(source);
    return { source: withHero, cards: withHero.children.slice(0, count) };
  }

  private static async contactErrors(req: Request, res: Response, fields: Record<string, string>): Promise<void> {
    const message = 'Please correct the highlighted fields.';
    if (wantsJson(req)) {
      res.status(422).json({ success: false, message, fields });
      return;
    }
    const values = bodyValues(req, CONTACT_FIELDS);
    const page = await PublicController.contactPage();
    if (!page) {
      throw new NotFoundError('The contact page is not published.');
    }
    const productId = Number(values.productId);
    const product = Number.isInteger(productId) && productId > 0 ? await PublicController.findProduct(productId) : null;
    res.status(422);
    await PublicController.renderPage(res, page, { values, errors: fields, sent: false, message }, product);
  }

  private static async donationErrors(req: Request, res: Response, fields: Record<string, string>): Promise<void> {
    const message = 'Please correct the highlighted fields.';
    if (wantsJson(req)) {
      res.status(422).json({ success: false, message, fields });
      return;
    }
    const page = await pagesService.findPublishedByKind('donations');
    if (!page) {
      throw new NotFoundError('The donations page is not published.');
    }
    res.status(422);
    await PublicController.renderDonations(res, page, { values: bodyValues(req, DONATION_FIELDS), errors: fields, sent: false, message });
  }

  private static async contactPage(): Promise<PageNode | null> {
    const config = await loadTransformConfig();
    return pagesService.findPublishedByKey(config.legacy.contactPageKey);
  }

  /** A published product page, or null when the id is not one of the products. */
  private static async findProduct(id: number): Promise<ProductRef | null> {
    const config = await loadTransformConfig();
    if (!config.legacy.productsPageKey) {
      return null;
    }
    const productsPage = await pagesService.findPublishedByKey(config.legacy.productsPageKey);
    const product = productsPage?.children.find((child) => child.id === id);
    return product ? { id: product.id, title: product.title } : null;
  }

  private static async isProduct(page: PageNode): Promise<boolean> {
    const config = await loadTransformConfig();
    if (!config.legacy.productsPageKey || page.parentId === null) {
      return false;
    }
    const productsPage = await pagesService.findPublishedByKey(config.legacy.productsPageKey);
    return productsPage?.id === page.parentId;
  }

  private static async renderPage(res: Response, page: PageNode, contactForm: FormState, product: ProductRef | null): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [sectionRoot, gallery, isProduct] = await Promise.all([
      pagesService.getSectionRoot(published),
      pagesService.getPageImages(published.id),
      PublicController.isProduct(published)
    ]);
    const breadcrumbs = [{ title: 'Home', url: '/' }, ...published.ancestors, { id: published.id, title: published.title, url: published.url }];
    pageSeo(res, published);
    const view = published.kind === 'contact' ? 'contact' : published.kind === 'section' || (published.content.trim() === '' && published.children.length > 0) ? 'section' : 'page';
    const contactUrl = res.locals.contactUrl as string;
    res.render(view, {
      page: published,
      sectionRoot,
      gallery,
      breadcrumbs,
      contactForm,
      product,
      enquireUrl: isProduct ? `${contactUrl}?product=${published.id}#contact-form` : null,
      bodyClass: `is-${view}`
    });
  }

  private static async renderDonations(res: Response, page: PageNode, donationForm: FormState): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    pageSeo(res, published);
    res.render('donations', {
      page: published,
      breadcrumbs: [{ title: 'Home', url: '/' }, ...published.ancestors, { title: published.title, url: published.url }],
      donationForm,
      bodyClass: 'is-donations'
    });
  }

  private static async renderPartners(res: Response, page: PageNode): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [partners, sectionRoot] = await Promise.all([partnersService.listActive(), pagesService.getSectionRoot(published)]);
    pageSeo(res, published);
    res.render('partners', {
      page: published,
      sectionRoot,
      partners,
      breadcrumbs: [{ title: 'Home', url: '/' }, ...published.ancestors, { title: published.title, url: published.url }],
      bodyClass: 'is-partners'
    });
  }

  private static renderListing(req: Request, res: Response, root: PageNode): void {
    const query = listingQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new NotFoundError('That page number does not exist.');
    }
    const requested = query.data.page ?? 1;
    const listing = collectionService.listing(root, requested);
    if (!listing) {
      throw new NotFoundError('That page number does not exist.');
    }
    pageSeo(res, root);
    const seo = res.locals.seo as Record<string, string>;
    if (requested > 1) {
      res.locals.seo = { ...seo, title: `${seo.title} (page ${requested})`, canonical: `${seo.canonical}?page=${requested}` };
    }
    res.render('news', {
      page: root,
      listing,
      breadcrumbs: [{ title: 'Home', url: '/' }, ...root.ancestors, { title: root.title, url: root.url }],
      bodyClass: 'is-news'
    });
  }

  private static async renderStory(req: Request, res: Response, page: PageNode): Promise<void> {
    const root = await collectionService.findRoot();
    if (!root) {
      throw new NotFoundError(`No page exists at ${req.path}.`);
    }
    const published = await pagesService.inheritHeroForPublish(page);
    const gallery = await pagesService.getPageImages(published.id);
    pageSeo(res, published, 'article');
    const settings = res.locals.settings as Settings;
    const baseUrl = resolveBaseUrl(req);
    const image = published.heroImage ? absolute(baseUrl, published.heroImage) : undefined;
    res.render('story', {
      page: published,
      card: toStoryCard(published),
      root,
      gallery,
      neighbours: collectionService.neighbours(root, published),
      breadcrumbs: [{ title: 'Home', url: '/' }, ...published.ancestors, { title: published.title, url: published.url }],
      bodyClass: 'is-story',
      jsonLd: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: published.title.slice(0, 110),
        datePublished: published.createdAt,
        dateModified: published.updatedAt,
        image: image ? [image] : undefined,
        author: { '@type': 'Organization', name: settings.siteName },
        publisher: { '@type': 'Organization', name: settings.siteName, logo: settings.logo ? { '@type': 'ImageObject', url: absolute(baseUrl, settings.logo) } : undefined },
        mainEntityOfPage: `${baseUrl}${published.url}`
      })
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
