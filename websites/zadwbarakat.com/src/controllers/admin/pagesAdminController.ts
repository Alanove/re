import type { Request, Response } from 'express';
import { z } from 'zod';
import { SLUG_PATTERN } from '../../domain/models.js';
import { parseOrThrow, safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody } from './pageForm.js';

const optionalPositiveId = z
  .string()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : null))
  .pipe(z.number().int().positive().nullable());

const slugCheckSchema = z.object({
  slug: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value.normalize('NFC'))
    .pipe(z.string().regex(SLUG_PATTERN)),
  parentId: optionalPositiveId,
  excludeId: optionalPositiveId
});

function parentOptions(pages: PageNode[], excludeId: number | null): { id: number; label: string }[] {
  return pages
    .filter((page) => excludeId === null || (page.id !== excludeId && !page.ancestors.some((ancestor) => ancestor.id === excludeId)))
    .map((page) => ({ id: page.id, label: `${'— '.repeat(page.depth)}${page.title}` }));
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
    renderPageForm(res, {
      pageTitle: 'Create Page',
      isCreate: true,
      page: blankPage(null),
      gallery: [],
      parents: parentOptions(pages, null)
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
      const page = await pagesService.createPage(parsed.data, uploads);
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
    renderPageForm(res, {
      pageTitle: `Edit: ${page.title}`,
      isCreate: false,
      page,
      gallery,
      parents: parentOptions(pages, id)
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
      const page = await pagesService.updatePage(id, parsed.data, uploads);
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

  private static async renderInvalid(res: Response, id: number | null, body: Record<string, unknown>, message: string, fields: Record<string, string>): Promise<void> {
    const pages = await pagesService.getFlatList();
    const existing = id === null ? null : await pagesService.getById(id);
    const gallery = id === null ? [] : await pagesService.getPageImages(id);
    res.status(422);
    renderPageForm(res, {
      pageTitle: id === null ? 'Create Page' : `Edit: ${existing?.title ?? ''}`,
      isCreate: id === null,
      page: valuesFromBody(body, existing ? { ...existing } : blankPage(null)),
      gallery,
      parents: parentOptions(pages, id),
      error: message,
      errors: fields
    });
  }
}
