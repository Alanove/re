import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { NEWS_COLLECTION, blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody } from './pageForm.js';

const UPLOAD_FOLDER = 'news';

export class NewsAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const [{ root, entries }, imageCounts] = await Promise.all([pagesService.getCollectionOverview(), pagesService.getImageCounts()]);
    render(res, 'news/list', {
      pageTitle: NEWS_COLLECTION.label,
      collection: NEWS_COLLECTION,
      root,
      entries: entries.map((entry) => ({ ...entry, imageCount: imageCounts.get(entry.id) ?? 0 }))
    });
  }

  public static async createForm(_req: Request, res: Response): Promise<void> {
    const root = await NewsAdminController.requireRoot();
    renderPageForm(res, {
      pageTitle: 'New story',
      mode: 'entry',
      root,
      isCreate: true,
      page: { ...blankPage(root.id), status: 'published' },
      gallery: [],
      parents: []
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = NewsAdminController.storyBody(req);
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await NewsAdminController.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = await pagesService.createStory(parsed.data, uploads);
      setFlash(req, 'success', `Story "${page.title}" was created.`);
      res.redirect(`${NEWS_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await NewsAdminController.renderInvalid(res, null, body, state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await NewsAdminController.requireRoot();
    const page = await pagesService.getById(id);
    const isRoot = page.id === root.id;
    if (!isRoot && page.parentId !== root.id) {
      throw new NotFoundError('That news story does not exist.');
    }
    renderPageForm(res, {
      pageTitle: isRoot ? 'News page settings' : `Edit: ${page.title}`,
      mode: isRoot ? 'root' : 'entry',
      root,
      isCreate: false,
      page,
      gallery: await pagesService.getPageImages(id),
      parents: []
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await NewsAdminController.requireRoot();
    const isRoot = id === root.id;
    const body = isRoot ? NewsAdminController.rootBody(req, root) : NewsAdminController.storyBody(req);
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await NewsAdminController.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = isRoot ? await pagesService.updatePage(id, parsed.data, uploads) : await pagesService.updateStory(id, parsed.data, uploads);
      setFlash(req, 'success', isRoot ? 'News page settings were saved.' : `Story "${page.title}" was saved.`);
      res.redirect(`${NEWS_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await NewsAdminController.renderInvalid(res, id, body, state.message, state.fields);
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await NewsAdminController.requireRoot();
    const page = await pagesService.getById(id);
    if (page.parentId !== root.id) {
      throw new NotFoundError('That news story does not exist.');
    }
    await pagesService.delete(id);
    res.json({ success: true, message: 'Story deleted.' });
  }

  /** Stories always live under the News page; the form has no type or parent fields. */
  private static storyBody(req: Request): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    return { ...body, kind: 'page', parentId: '', icon: '' };
  }

  private static rootBody(req: Request, root: PageNode): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    return { ...body, kind: root.kind, parentId: root.parentId === null ? '' : String(root.parentId), icon: root.icon };
  }

  private static async requireRoot(): Promise<PageNode> {
    const root = await pagesService.getNewsRoot();
    if (!root) {
      throw new NotFoundError('The News page is missing. Run the content import to create it.');
    }
    return root;
  }

  private static async renderInvalid(res: Response, id: number | null, body: Record<string, unknown>, message: string, fields: Record<string, string>): Promise<void> {
    const root = await NewsAdminController.requireRoot();
    const existing = id === null ? null : await pagesService.getById(id);
    const gallery = id === null ? [] : await pagesService.getPageImages(id);
    const isRoot = id === root.id;
    res.status(422);
    renderPageForm(res, {
      pageTitle: isRoot ? 'News page settings' : id === null ? 'New story' : `Edit: ${existing?.title ?? ''}`,
      mode: isRoot ? 'root' : 'entry',
      root,
      isCreate: id === null,
      page: valuesFromBody(body, existing ? { ...existing } : blankPage(root.id)),
      gallery,
      parents: [],
      error: message,
      errors: fields
    });
  }
}
