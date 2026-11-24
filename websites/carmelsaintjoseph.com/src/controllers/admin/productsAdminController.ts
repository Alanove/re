import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { PRODUCTS_COLLECTION, blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody } from './pageForm.js';

const UPLOAD_FOLDER = 'products';

function categoryOptions(categories: PageNode[]): { id: number; label: string }[] {
  return categories.map((category) => ({ id: category.id, label: category.title }));
}

export class ProductsAdminController {
  public static async list(req: Request, res: Response): Promise<void> {
    const [root, products, categories, imageCounts] = await Promise.all([
      pagesService.getProductsRoot(),
      pagesService.getProductsList(),
      pagesService.getCategoriesList(),
      pagesService.getImageCounts()
    ]);
    const categoryFilter = typeof req.query.category === 'string' ? Number.parseInt(req.query.category, 10) : NaN;
    const filtered = Number.isFinite(categoryFilter)
      ? products.filter((product) => product.parentId === categoryFilter)
      : products;
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    render(res, 'products/list', {
      pageTitle: PRODUCTS_COLLECTION.label,
      collection: PRODUCTS_COLLECTION,
      root,
      categories,
      filter: { category: Number.isFinite(categoryFilter) ? categoryFilter : null },
      products: filtered.map((product) => ({
        ...product,
        categoryName: categoryById.get(product.parentId ?? 0)?.title ?? '—',
        imageCount: imageCounts.get(product.id) ?? 0
      }))
    });
  }

  public static async createForm(req: Request, res: Response): Promise<void> {
    const [root, categories] = await Promise.all([ProductsAdminController.requireRoot(), pagesService.getCategoriesList()]);
    const preferred = typeof req.query.category === 'string' ? Number.parseInt(req.query.category, 10) : NaN;
    const parentId = Number.isFinite(preferred) && categories.some((category) => category.id === preferred)
      ? preferred
      : categories[0]?.id ?? null;
    renderPageForm(res, {
      pageTitle: 'New product',
      mode: 'entry',
      isCreate: true,
      page: { ...blankPage(parentId), status: 'published' },
      gallery: [],
      parents: categoryOptions(categories),
      collection: PRODUCTS_COLLECTION,
      root
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(pageFormSchema, { ...body, kind: 'page' });
    if (!parsed.ok) {
      await ProductsAdminController.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = await pagesService.createProduct(parsed.data, uploads);
      setFlash(req, 'success', `Product "${page.title}" was created.`);
      res.redirect(`${PRODUCTS_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await ProductsAdminController.renderInvalid(res, null, body, state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const [root, page, categories] = await Promise.all([
      ProductsAdminController.requireRoot(),
      pagesService.getById(id),
      pagesService.getCategoriesList()
    ]);
    if (page.id === root.id) {
      renderPageForm(res, {
        pageTitle: 'Products page settings',
        mode: 'root',
        isCreate: false,
        page,
        gallery: await pagesService.getPageImages(id),
        parents: [],
        collection: PRODUCTS_COLLECTION,
        root
      });
      return;
    }
    if (!pagesService.isProductPage(page, root)) {
      throw new NotFoundError('Product not found.');
    }
    renderPageForm(res, {
      pageTitle: `Edit: ${page.title}`,
      mode: 'entry',
      isCreate: false,
      page,
      gallery: await pagesService.getPageImages(id),
      parents: categoryOptions(categories),
      collection: PRODUCTS_COLLECTION,
      root
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await ProductsAdminController.requireRoot();
    const isRoot = id === root.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(
      pageFormSchema,
      isRoot ? { ...body, kind: 'section', parentId: root.parentId === null ? '' : String(root.parentId) } : { ...body, kind: 'page' }
    );
    if (!parsed.ok) {
      await ProductsAdminController.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, UPLOAD_FOLDER);
    try {
      const page = isRoot
        ? await pagesService.updateProductsRoot(id, parsed.data, uploads)
        : await pagesService.updateProduct(id, parsed.data, uploads);
      setFlash(req, 'success', isRoot ? 'Products page settings were saved.' : `Product "${page.title}" was saved.`);
      res.redirect(`${PRODUCTS_COLLECTION.basePath}/${page.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await ProductsAdminController.renderInvalid(res, id, body, state.message, state.fields);
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const root = await ProductsAdminController.requireRoot();
    const page = await pagesService.getById(id);
    if (!pagesService.isProductPage(page, root)) {
      throw new NotFoundError('Product not found.');
    }
    await pagesService.delete(id);
    res.json({ success: true, message: 'Product deleted.' });
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
    const [root, categories] = await Promise.all([ProductsAdminController.requireRoot(), pagesService.getCategoriesList()]);
    const existing = id === null ? null : await pagesService.getById(id);
    const isRoot = id === root.id;
    res.status(422);
    renderPageForm(res, {
      pageTitle: isRoot ? 'Products page settings' : id === null ? 'New product' : `Edit: ${existing?.title ?? ''}`,
      mode: isRoot ? 'root' : 'entry',
      isCreate: id === null,
      page: valuesFromBody(body, existing ? { ...existing } : blankPage(categories[0]?.id ?? null)),
      gallery: id === null ? [] : await pagesService.getPageImages(id),
      parents: isRoot ? [] : categoryOptions(categories),
      collection: PRODUCTS_COLLECTION,
      root,
      error: message,
      errors: fields
    });
  }
}
