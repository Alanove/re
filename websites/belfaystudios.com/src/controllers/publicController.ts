import type { Request, Response } from 'express';
import { loadTransformConfig } from '../config/transform.js';
import type { Settings } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { resolveBaseUrl } from '../middleware/siteLocals.js';
import { parseOrThrow, safeParseFields } from '../middleware/validate.js';
import { blogListQuerySchema, contactFormSchema } from '../schemas/publicSchemas.js';
import { blogService, toPostCard } from '../services/blogService.js';
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
    if (page.kind === 'blog') {
      PublicController.renderBlog(req, res, page);
      return;
    }
    await PublicController.renderPage(res, page, emptyForm(req.query.sent === '1'));
  }

  public static async submitContact(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(contactFormSchema, req.body);
    if (!parsed.ok) {
      await PublicController.respondWithErrors(req, res, parsed.fields);
      return;
    }
    try {
      await contactService.submit(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' });
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await PublicController.respondWithErrors(req, res, error.fields);
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

  public static async sitemap(req: Request, res: Response): Promise<void> {
    const baseUrl = resolveBaseUrl(req);
    const pages = (await pagesService.getPublishedTree()).flatMap(function flat(node): PageNode[] {
      return [node, ...node.children.flatMap(flat)];
    });
    const urls = [...new Set(['/', ...pages.map((page) => page.url)])];
    const body = urls.map((url) => `  <url><loc>${baseUrl}${url === '/' ? '/' : url}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  }

  public static robots(req: Request, res: Response): void {
    const baseUrl = resolveBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  private static async renderHome(res: Response, contactForm: ContactFormState): Promise<void> {
    const home = await homeService.get();
    const latest = home.latestPosts.enabled ? await blogService.latest(home.latestPosts.limit) : { root: null, posts: [] };
    res.render('home', {
      home,
      latestPosts: latest.posts,
      blogUrl: latest.root?.url ?? '',
      bodyClass: 'is-home',
      contactForm
    });
  }

  private static renderBlog(req: Request, res: Response, root: PageNode): void {
    const query = parseOrThrow(blogListQuerySchema, req.query);
    const listing = blogService.listing(root, query.page);
    if (!listing) {
      throw new NotFoundError('This page of the blog does not exist.');
    }
    pageSeo(res, root);
    const seo = res.locals.seo as Record<string, string>;
    if (listing.page > 1) {
      res.locals.seo = { ...seo, title: `${root.title} - Page ${listing.page} | ${(res.locals.settings as Settings).siteName}`, canonical: `${seo.canonical}?page=${listing.page}` };
    }
    res.render('blog/index', {
      page: root,
      listing,
      breadcrumbs: [{ title: 'Home', url: '/' }, { id: root.id, title: root.title, url: root.url }],
      bodyClass: 'is-blog'
    });
  }

  private static async respondWithErrors(req: Request, res: Response, fields: Record<string, string>): Promise<void> {
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
    const page = await PublicController.contactPage();
    if (page) {
      await PublicController.renderPage(res, page, state);
      return;
    }
    await PublicController.renderHome(res, state);
  }

  private static async contactPage(): Promise<PageNode | null> {
    const config = await loadTransformConfig();
    return pagesService.findPublishedByKey(config.legacy.contactPageKey);
  }

  private static async renderPage(res: Response, page: PageNode, contactForm: ContactFormState): Promise<void> {
    const published = await pagesService.inheritHeroForPublish(page);
    const [sectionRoot, gallery, blogRoot] = await Promise.all([pagesService.getSectionRoot(published), pagesService.getPageImages(published.id), blogService.findRoot()]);
    const breadcrumbs = [{ title: 'Home', url: '/' }, ...published.ancestors, { id: published.id, title: published.title, url: published.url }];
    if (blogRoot && blogService.isPostOf(blogRoot, published)) {
      pageSeo(res, page, 'article');
      res.render('blog/post', {
        page: published,
        post: toPostCard(page),
        blogRoot,
        ...blogService.neighbours(blogRoot, published),
        gallery,
        breadcrumbs,
        bodyClass: 'is-post'
      });
      return;
    }
    pageSeo(res, published);
    const view = published.kind === 'contact' ? 'contact' : published.kind === 'section' || (published.content.trim() === '' && published.children.length > 0) ? 'section' : 'page';
    res.render(view, {
      page: published,
      sectionRoot,
      gallery,
      breadcrumbs,
      contactForm,
      bodyClass: `is-${view}`
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
