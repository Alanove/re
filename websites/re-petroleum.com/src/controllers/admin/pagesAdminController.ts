import type { Request, Response } from 'express';
import { z } from 'zod';
import { pageKindSchema } from '../../domain/models.js';
import { filesFor, firstFile } from '../../middleware/upload.js';
import { parseOrThrow, safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode, type PageUploads } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

const KIND_OPTIONS = pageKindSchema.options.map((kind) => ({
  value: kind,
  label: { page: 'Content page', section: 'Section landing (lists child pages)', contact: 'Contact page', footer: 'Footer data (not routed)' }[kind]
}));

const slugCheckSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  parentId: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : null))
    .pipe(z.number().int().positive().nullable()),
  excludeId: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : null))
    .pipe(z.number().int().positive().nullable())
});

function blankPage(): Record<string, unknown> {
  return {
    id: null,
    title: '',
    header: '',
    slug: '',
    parentId: null,
    summary: '',
    content: '',
    status: 'draft',
    kind: 'page',
    sort: 100,
    icon: '',
    heroImage: '',
    heroVideo: '',
    seo: { title: '', description: '', keywords: '' },
    url: ''
  };
}

function valuesFromBody(body: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return {
    ...base,
    title: text('title'),
    header: text('header'),
    slug: text('slug'),
    parentId: text('parentId') ? Number.parseInt(text('parentId'), 10) : null,
    summary: text('summary'),
    content: text('content'),
    status: body.published ? 'published' : 'draft',
    kind: text('kind') || 'page',
    sort: text('sort'),
    icon: text('icon'),
    heroImage: text('heroImage'),
    heroVideo: text('heroVideo'),
    seo: { title: text('seoTitle'), description: text('seoDescription'), keywords: text('seoKeywords') }
  };
}

function parentOptions(pages: PageNode[], excludeId: number | null): { id: number; label: string }[] {
  const blocked = new Set<number>();
  if (excludeId !== null) {
    const collect = (node: PageNode): void => {
      blocked.add(node.id);
      node.children.forEach(collect);
    };
    const self = pages.find((page) => page.id === excludeId);
    if (self) {
      collect(self);
    }
  }
  return pages
    .filter((page) => !blocked.has(page.id) && page.kind !== 'footer')
    .map((page) => ({ id: page.id, label: `${'— '.repeat(page.depth)}${page.title}` }));
}

function uploadedFiles(uploads: PageUploads): { url: string }[] {
  return [...(uploads.hero ? [uploads.hero] : []), ...(uploads.heroVideo ? [uploads.heroVideo] : []), ...uploads.gallery];
}

async function saveUploads(req: Request, folder: string): Promise<PageUploads> {
  const uploads: PageUploads = { hero: null, heroVideo: null, gallery: [] };
  try {
    const heroFile = firstFile(req, 'heroImageFile');
    uploads.hero = heroFile ? await mediaService.saveImage(heroFile, folder) : null;
    const videoFile = firstFile(req, 'heroVideoFile');
    uploads.heroVideo = videoFile ? await mediaService.saveVideo(videoFile, folder) : null;
    for (const file of filesFor(req, 'galleryFiles')) {
      uploads.gallery.push(await mediaService.saveImage(file, folder));
    }
    return uploads;
  } catch (error) {
    await mediaService.discard(uploadedFiles(uploads));
    throw error;
  }
}

export class PagesAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const [pages, imageCounts] = await Promise.all([pagesService.getFlatList(), pagesService.getImageCounts()]);
    render(res, 'pages/list', {
      pageTitle: 'Pages',
      pages: pages.map((page) => ({ ...page, imageCount: imageCounts.get(page.id) ?? 0 }))
    });
  }

  public static async createForm(_req: Request, res: Response): Promise<void> {
    const pages = await pagesService.getFlatList();
    render(res, 'pages/edit', {
      pageTitle: 'Create Page',
      isCreate: true,
      page: blankPage(),
      gallery: [],
      parents: parentOptions(pages, null),
      kinds: KIND_OPTIONS,
      includeCustomEditor: true
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await PagesAdminController.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, 'pages');
    try {
      const page = await pagesService.create(parsed.data, uploads);
      setFlash(req, 'success', `Page "${page.title}" was created.`);
      res.redirect(`/admin/pages/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await PagesAdminController.renderInvalid(res, null, body, state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const [page, gallery, pages] = await Promise.all([pagesService.getById(id), pagesService.getPageImages(id), pagesService.getFlatList()]);
    render(res, 'pages/edit', {
      pageTitle: `Edit: ${page.title}`,
      isCreate: false,
      page,
      gallery,
      parents: parentOptions(pages, id),
      kinds: KIND_OPTIONS,
      includeCustomEditor: true
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await PagesAdminController.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, 'pages');
    try {
      const page = await pagesService.update(id, parsed.data, uploads);
      setFlash(req, 'success', `Page "${page.title}" was saved.`);
      res.redirect(`/admin/pages/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await PagesAdminController.renderInvalid(res, id, body, state.message, state.fields);
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await pagesService.delete(id);
    res.json({ success: true, message: 'Page deleted.' });
  }

  public static async removeHeroImage(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await pagesService.removeHeroImage(id);
    res.json({ success: true, message: 'Header image removed.' });
  }

  public static async checkSlug(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(slugCheckSchema, req.query);
    const available = await pagesService.isSlugAvailable(query.slug, query.parentId, query.excludeId);
    res.json({ success: true, available });
  }

  private static async renderInvalid(
    res: Response,
    id: number | null,
    body: Record<string, unknown>,
    message: string,
    fields: Record<string, string>
  ): Promise<void> {
    const pages = await pagesService.getFlatList();
    const existing = id === null ? null : await pagesService.getById(id);
    const gallery = id === null ? [] : await pagesService.getPageImages(id);
    res.status(422);
    render(res, 'pages/edit', {
      pageTitle: id === null ? 'Create Page' : `Edit: ${existing?.title ?? ''}`,
      isCreate: id === null,
      page: valuesFromBody(body, existing ? { ...existing } : blankPage()),
      gallery,
      parents: parentOptions(pages, id),
      kinds: KIND_OPTIONS,
      includeCustomEditor: true,
      error: message,
      errors: fields
    });
  }
}
