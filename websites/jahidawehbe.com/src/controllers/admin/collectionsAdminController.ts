import type { Request, Response } from 'express';
import type { CollectionKind } from '../../domain/models.js';
import { NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { isUpcoming } from '../../services/collectionService.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { COLLECTIONS, blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody, type CollectionMeta } from './pageForm.js';

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export class CollectionsAdminController {
  private readonly meta: CollectionMeta;

  public constructor(kind: CollectionKind) {
    this.meta = COLLECTIONS[kind];
  }

  public list = async (_req: Request, res: Response): Promise<void> => {
    const [{ root, entries }, imageCounts] = await Promise.all([pagesService.getCollectionOverview(this.meta.kind), pagesService.getImageCounts()]);
    render(res, 'collections/list', {
      pageTitle: this.meta.label,
      collection: this.meta,
      root,
      entries: entries.map((entry) => ({
        ...entry,
        imageCount: imageCounts.get(entry.id) ?? 0,
        upcoming: this.meta.kind === 'events' && isUpcoming(entry)
      }))
    });
  };

  public createForm = async (_req: Request, res: Response): Promise<void> => {
    const root = await this.requireRoot();
    renderPageForm(res, {
      pageTitle: `New ${this.meta.singular}`,
      mode: 'entry',
      collection: this.meta,
      root,
      isCreate: true,
      page: { ...blankPage(root.id), status: 'published' },
      gallery: [],
      parents: []
    });
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const body = this.entryBody(req);
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await this.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, this.meta.kind);
    try {
      const page = await pagesService.createEntry(this.meta.kind, parsed.data, uploads);
      setFlash(req, 'success', `${capitalise(this.meta.singular)} "${page.title}" was created.`);
      res.redirect(`${this.meta.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await this.renderInvalid(res, null, body, state.message, state.fields);
    }
  };

  public editForm = async (req: Request, res: Response): Promise<void> => {
    const { id } = params(idParamSchema, req);
    const root = await this.requireRoot();
    const page = await pagesService.getById(id);
    const isRoot = page.id === root.id;
    if (!isRoot && !pagesService.isEntryOf(page, root)) {
      throw new NotFoundError(`That ${this.meta.singular} does not exist.`);
    }
    const gallery = await pagesService.getPageImages(id);
    renderPageForm(res, {
      pageTitle: isRoot ? `${this.meta.label} page settings` : `Edit: ${page.title}`,
      mode: isRoot ? 'root' : 'entry',
      collection: this.meta,
      root,
      isCreate: false,
      page,
      gallery,
      parents: []
    });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params(idParamSchema, req);
    const root = await this.requireRoot();
    const isRoot = id === root.id;
    const body = isRoot ? this.rootBody(req, root) : this.entryBody(req);
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await this.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, this.meta.kind);
    try {
      const page = isRoot
        ? await pagesService.updatePage(id, parsed.data, uploads)
        : await pagesService.updateEntry(this.meta.kind, id, parsed.data, uploads);
      setFlash(req, 'success', isRoot ? `${this.meta.label} page settings were saved.` : `${capitalise(this.meta.singular)} "${page.title}" was saved.`);
      res.redirect(`${this.meta.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await this.renderInvalid(res, id, body, state.message, state.fields);
    }
  };

  /** Entries always live under the collection page; the form has no kind or parent fields. */
  private entryBody(req: Request): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    return { ...body, kind: 'page', parentId: '' };
  }

  private rootBody(req: Request, root: PageNode): Record<string, unknown> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    return { ...body, kind: root.kind, parentId: root.parentId === null ? '' : String(root.parentId), eventDate: '', venue: '' };
  }

  private async requireRoot(): Promise<PageNode> {
    const root = await pagesService.getCollectionRoot(this.meta.kind);
    if (!root) {
      throw new NotFoundError(`The ${this.meta.label} page is missing. Run the content import to create it.`);
    }
    return root;
  }

  private async renderInvalid(
    res: Response,
    id: number | null,
    body: Record<string, unknown>,
    message: string,
    fields: Record<string, string>
  ): Promise<void> {
    const root = await this.requireRoot();
    const existing = id === null ? null : await pagesService.getById(id);
    const gallery = id === null ? [] : await pagesService.getPageImages(id);
    const isRoot = id === root.id;
    res.status(422);
    renderPageForm(res, {
      pageTitle: isRoot ? `${this.meta.label} page settings` : id === null ? `New ${this.meta.singular}` : `Edit: ${existing?.title ?? ''}`,
      mode: isRoot ? 'root' : 'entry',
      collection: this.meta,
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

export const newsAdminController = new CollectionsAdminController('news');
export const eventsAdminController = new CollectionsAdminController('events');
