import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { CATEGORIES_COLLECTION, blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody } from './pageForm.js';

const UPLOAD_FOLDER = 'products';

export class CategoriesAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const [root, categories, products, imageCounts] = await Promise.all([
      pagesService.getProductsRoot(),
      pagesService.getCategoriesList(),
      pagesService.getProductsList(),
      pagesService.getImageCounts()
    ]);
    const counts = new Map<number, number>();
    for (const product of products) {
      if (product.parentId !== null) {
        counts.set(product.parentId, (counts.get(product.parentId) ?? 0) + 1);
      }
    }
    render(res, 'categories/list', {
      pageTitle: CATEGORIES_COLLECTION.label,
      collection: CATEGORIES_COLLECTION,
      root,
      categories: categories.map((category) => ({
        ...category,
        productCount: counts.get(category.id) ?? 0,
        imageCount: imageCounts.get(category.id) ?? 0
      }))
    });
  }

  public static async createForm(_req: Request, res: Response): Promise<void> {
    const root = await CategoriesAdminController.requireRoot();
    renderPageForm(res, {
      pageTitle: 'New category',
      mode: 'entry',
      isCreate: true,
      page: { ...blankPage(root.id), kind: 'section', status: 'published' },
      gallery: [],
      parents: [],
      collection: CATEGORIES_COLLECTION,
      root
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = { ...((req.body ?? {}) as Record<string, unknown>), kind: 'section' };
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await CategoriesAdminController.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = await pagesService.createCategory(parsed.data, uploads);
      setFlash(req, 'success', `Category "${page.title}" was created.`);
      res.redirect(`${CATEGORIES_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await CategoriesAdminController.renderInvalid(res, null, body, state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const [root, page] = await Promise.all([CategoriesAdminController.requireRoot(), pagesService.getById(id)]);
    if (!pagesService.isProductCategory(page, root)) {
      throw new NotFoundError('Category not found.');
    }
    renderPageForm(res, {
      pageTitle: `Edit: ${page.title}`,
      mode: 'entry',
      isCreate: false,
      page,
      gallery: await pagesService.getPageImages(id),
      parents: [],
      collection: CATEGORIES_COLLECTION,
      root
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const body = { ...((req.body ?? {}) as Record<string, unknown>), kind: 'section' };
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await CategoriesAdminController.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = await pagesService.updateCategory(id, parsed.data, uploads);
      setFlash(req, 'success', `Category "${page.title}" was saved.`);
      res.redirect(`${CATEGORIES_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await CategoriesAdminController.renderInvalid(res, id, body, state.message, state.fields);
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await CategoriesAdminController.requireRoot();
    const page = await pagesService.getById(id);
    if (!pagesService.isProductCategory(page, root)) {
      throw new NotFoundError('Category not found.');
    }
    await pagesService.delete(id);
    res.json({ success: true, message: 'Category deleted.' });
  }

  private static async requireRoot(): Promise<PageNode> {
    const root = await pagesService.getProductsRoot();
    if (!root) {
      throw new NotFoundError('The Products page is missing.');
    }
    return root;
  }

  private static async renderInvalid(
    res: Response,
    id: number | null,
    body: Record<string, unknown>,
    message: string,
    fields: Record<string, string>
  ): Promise<void> {
    const root = await CategoriesAdminController.requireRoot();
    const existing = id === null ? null : await pagesService.getById(id);
    res.status(422);
    renderPageForm(res, {
      pageTitle: id === null ? 'New category' : `Edit: ${existing?.title ?? ''}`,
      mode: 'entry',
      isCreate: id === null,
      page: valuesFromBody(body, existing ? { ...existing } : blankPage(root.id)),
      gallery: id === null ? [] : await pagesService.getPageImages(id),
      parents: [],
      collection: CATEGORIES_COLLECTION,
      root,
      error: message,
      errors: fields
    });
  }
}
