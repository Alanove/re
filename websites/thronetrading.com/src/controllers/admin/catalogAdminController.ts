import type { Request, Response } from 'express';
import { PRODUCT_IMAGES_MAX, PRODUCT_SPECS_MAX, type Brand, type Category, type Product } from '../../domain/models.js';
import { filesFor, firstFile } from '../../middleware/upload.js';
import { parseOrThrow, safeParseFields } from '../../middleware/validate.js';
import { brandFormSchema, catalogSlugCheckSchema, categoryFormSchema, idParamSchema, productFormSchema, productListQuerySchema } from '../../schemas/adminSchemas.js';
import { brandsAdminService, categoriesAdminService, productsAdminService } from '../../services/catalogAdminService.js';
import { brandUrl, categoryUrl } from '../../services/catalogService.js';
import { mediaService } from '../../services/mediaService.js';
import type { UploadedImage } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

type Body = Record<string, unknown>;

const text = (body: Body, key: string): string => (typeof body[key] === 'string' ? body[key] : '');

function seoFromBody(body: Body): Category['seo'] {
  return { title: text(body, 'seoTitle'), description: text(body, 'seoDescription'), keywords: text(body, 'seoKeywords') };
}

function listFromBody(value: unknown): Body[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Body => Boolean(entry) && typeof entry === 'object');
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, Body>);
  }
  return [];
}

async function saveSingle(req: Request, field: string, folder: string, preset: 'card' | 'logo'): Promise<UploadedImage | null> {
  const file = firstFile(req, field);
  return file ? mediaService.saveImage(file, folder, preset) : null;
}

async function respondWithFormError(error: unknown, uploads: UploadedImage[], onInvalid: (message: string, fields: Record<string, string>) => void | Promise<void>): Promise<void> {
  await mediaService.discard(uploads);
  const state = formErrorState(error);
  if (!state) {
    throw error;
  }
  await onInvalid(state.message, state.fields);
}

export class CategoriesAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'catalog/categories-list', { pageTitle: 'Categories', categories: await categoriesAdminService.list() });
  }

  public static createForm(_req: Request, res: Response): void {
    CategoriesAdminController.renderForm(res, null, CategoriesAdminController.blank());
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(categoryFormSchema, body);
    if (!parsed.ok) {
      CategoriesAdminController.renderForm(res, null, CategoriesAdminController.fromBody(body, CategoriesAdminController.blank()), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    let image: UploadedImage | null = null;
    try {
      image = await saveSingle(req, 'imageFile', 'catalog/categories', 'card');
      const category = await categoriesAdminService.create(parsed.data, image);
      setFlash(req, 'success', `Category "${category.name}" was created.`);
      res.redirect(`/admin/categories/${category.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, image ? [image] : [], (message, fields) => {
        CategoriesAdminController.renderForm(res, null, CategoriesAdminController.fromBody(body, CategoriesAdminController.blank()), message, fields);
      });
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    CategoriesAdminController.renderForm(res, id, await categoriesAdminService.get(id));
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const existing = await categoriesAdminService.get(id);
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(categoryFormSchema, body);
    if (!parsed.ok) {
      CategoriesAdminController.renderForm(res, id, CategoriesAdminController.fromBody(body, existing), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    let image: UploadedImage | null = null;
    try {
      image = await saveSingle(req, 'imageFile', 'catalog/categories', 'card');
      const category = await categoriesAdminService.update(id, parsed.data, image);
      setFlash(req, 'success', `Category "${category.name}" was saved.`);
      res.redirect(`/admin/categories/${category.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, image ? [image] : [], (message, fields) => {
        CategoriesAdminController.renderForm(res, id, CategoriesAdminController.fromBody(body, existing), message, fields);
      });
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await categoriesAdminService.delete(id);
    res.json({ success: true, message: 'Category deleted.' });
  }

  private static blank(): Category {
    const now = new Date().toISOString();
    return { id: 0, slug: '', name: '', summary: '', description: '', image: '', icon: '', status: 'published', sort: 100, seo: { title: '', description: '', keywords: '' }, createdAt: now, updatedAt: now };
  }

  private static fromBody(body: Body, base: Category): Category {
    return {
      ...base,
      name: text(body, 'name'),
      slug: text(body, 'slug'),
      summary: text(body, 'summary'),
      description: text(body, 'description'),
      image: text(body, 'image'),
      icon: text(body, 'icon'),
      status: body.published ? 'published' : 'draft',
      sort: Number.parseInt(text(body, 'sort'), 10) || 0,
      seo: seoFromBody(body)
    };
  }

  private static renderForm(res: Response, id: number | null, category: Category, error?: string, errors?: Record<string, string>): void {
    if (error) {
      res.status(422);
    }
    render(res, 'catalog/category-edit', {
      pageTitle: id === null ? 'Create Category' : `Edit: ${category.name}`,
      breadcrumbs: [{ text: 'Categories', url: '/admin/categories' }],
      isCreate: id === null,
      category,
      publicUrl: id === null ? '' : categoryUrl(category.slug),
      includeCustomEditor: true,
      error: error ?? null,
      errors: errors ?? {}
    });
  }
}

export class BrandsAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'catalog/brands-list', { pageTitle: 'Brands', brands: await brandsAdminService.list() });
  }

  public static createForm(_req: Request, res: Response): void {
    BrandsAdminController.renderForm(res, null, BrandsAdminController.blank());
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(brandFormSchema, body);
    if (!parsed.ok) {
      BrandsAdminController.renderForm(res, null, BrandsAdminController.fromBody(body, BrandsAdminController.blank()), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    let logo: UploadedImage | null = null;
    try {
      logo = await saveSingle(req, 'logoFile', 'catalog/brands', 'logo');
      const brand = await brandsAdminService.create(parsed.data, logo);
      setFlash(req, 'success', `Brand "${brand.name}" was created.`);
      res.redirect(`/admin/brands/${brand.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, logo ? [logo] : [], (message, fields) => {
        BrandsAdminController.renderForm(res, null, BrandsAdminController.fromBody(body, BrandsAdminController.blank()), message, fields);
      });
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    BrandsAdminController.renderForm(res, id, await brandsAdminService.get(id));
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const existing = await brandsAdminService.get(id);
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(brandFormSchema, body);
    if (!parsed.ok) {
      BrandsAdminController.renderForm(res, id, BrandsAdminController.fromBody(body, existing), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    let logo: UploadedImage | null = null;
    try {
      logo = await saveSingle(req, 'logoFile', 'catalog/brands', 'logo');
      const brand = await brandsAdminService.update(id, parsed.data, logo);
      setFlash(req, 'success', `Brand "${brand.name}" was saved.`);
      res.redirect(`/admin/brands/${brand.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, logo ? [logo] : [], (message, fields) => {
        BrandsAdminController.renderForm(res, id, BrandsAdminController.fromBody(body, existing), message, fields);
      });
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await brandsAdminService.delete(id);
    res.json({ success: true, message: 'Brand deleted. Its products are now unbranded.' });
  }

  private static blank(): Brand {
    const now = new Date().toISOString();
    return {
      id: 0,
      slug: '',
      name: '',
      logo: '',
      summary: '',
      description: '',
      website: '',
      status: 'published',
      featured: true,
      sort: 100,
      seo: { title: '', description: '', keywords: '' },
      createdAt: now,
      updatedAt: now
    };
  }

  private static fromBody(body: Body, base: Brand): Brand {
    return {
      ...base,
      name: text(body, 'name'),
      slug: text(body, 'slug'),
      logo: text(body, 'logo'),
      summary: text(body, 'summary'),
      description: text(body, 'description'),
      website: text(body, 'website'),
      status: body.published ? 'published' : 'draft',
      featured: Boolean(body.featured),
      sort: Number.parseInt(text(body, 'sort'), 10) || 0,
      seo: seoFromBody(body)
    };
  }

  private static renderForm(res: Response, id: number | null, brand: Brand, error?: string, errors?: Record<string, string>): void {
    if (error) {
      res.status(422);
    }
    render(res, 'catalog/brand-edit', {
      pageTitle: id === null ? 'Create Brand' : `Edit: ${brand.name}`,
      breadcrumbs: [{ text: 'Brands', url: '/admin/brands' }],
      isCreate: id === null,
      brand,
      publicUrl: id === null ? '' : brandUrl(brand.slug),
      includeCustomEditor: true,
      error: error ?? null,
      errors: errors ?? {}
    });
  }
}

export class ProductsAdminController {
  public static async list(req: Request, res: Response): Promise<void> {
    const filter = parseOrThrow(productListQuerySchema, req.query);
    const [products, options] = await Promise.all([productsAdminService.list(filter), productsAdminService.options()]);
    render(res, 'catalog/products-list', { pageTitle: 'Products', products, options, filter });
  }

  public static async createForm(req: Request, res: Response): Promise<void> {
    const product = ProductsAdminController.blank();
    const preset = parseOrThrow(productListQuerySchema, req.query);
    if (preset.category !== null) {
      product.categoryId = preset.category;
    }
    await ProductsAdminController.renderForm(res, null, product);
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(productFormSchema, body);
    if (!parsed.ok) {
      await ProductsAdminController.renderForm(res, null, ProductsAdminController.fromBody(body, ProductsAdminController.blank()), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads: UploadedImage[] = [];
    try {
      await ProductsAdminController.saveImages(req, uploads);
      const product = await productsAdminService.create(parsed.data, uploads);
      setFlash(req, 'success', `Product "${product.name}" was created.`);
      res.redirect(`/admin/products/${product.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, uploads, (message, fields) =>
        ProductsAdminController.renderForm(res, null, ProductsAdminController.fromBody(body, ProductsAdminController.blank()), message, fields)
      );
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await ProductsAdminController.renderForm(res, id, await productsAdminService.get(id));
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const existing = await productsAdminService.get(id);
    const body = (req.body ?? {}) as Body;
    const parsed = safeParseFields(productFormSchema, body);
    if (!parsed.ok) {
      await ProductsAdminController.renderForm(res, id, ProductsAdminController.fromBody(body, existing), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads: UploadedImage[] = [];
    try {
      await ProductsAdminController.saveImages(req, uploads);
      const product = await productsAdminService.update(id, parsed.data, uploads);
      setFlash(req, 'success', `Product "${product.name}" was saved.`);
      res.redirect(`/admin/products/${product.id}/edit`);
    } catch (error) {
      await respondWithFormError(error, uploads, (message, fields) => ProductsAdminController.renderForm(res, id, ProductsAdminController.fromBody(body, existing), message, fields));
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await productsAdminService.delete(id);
    res.json({ success: true, message: 'Product deleted.' });
  }

  public static async checkSlug(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(catalogSlugCheckSchema, req.query);
    let available: boolean;
    if (query.type === 'category') {
      available = await categoriesAdminService.isSlugAvailable(query.slug, query.excludeId);
    } else if (query.type === 'brand') {
      available = await brandsAdminService.isSlugAvailable(query.slug, query.excludeId);
    } else {
      available = await productsAdminService.isSlugAvailable(query.slug, query.parentId, query.excludeId);
    }
    res.json({ success: true, available });
  }

  private static async saveImages(req: Request, uploads: UploadedImage[]): Promise<void> {
    for (const file of filesFor(req, 'imageFiles')) {
      uploads.push(await mediaService.saveImage(file, 'catalog/products', 'product'));
    }
  }

  private static blank(): Product {
    const now = new Date().toISOString();
    return {
      id: 0,
      slug: '',
      categoryId: 0,
      brandId: null,
      name: '',
      model: '',
      tagline: '',
      summary: '',
      specs: [],
      description: '',
      images: [],
      featured: false,
      status: 'published',
      sort: 100,
      seo: { title: '', description: '', keywords: '' },
      createdAt: now,
      updatedAt: now
    };
  }

  private static fromBody(body: Body, base: Product): Product {
    const known = new Map(base.images.map((image) => [image.src, image]));
    return {
      ...base,
      name: text(body, 'name'),
      slug: text(body, 'slug'),
      categoryId: Number.parseInt(text(body, 'categoryId'), 10) || 0,
      brandId: Number.parseInt(text(body, 'brandId'), 10) || null,
      model: text(body, 'model'),
      tagline: text(body, 'tagline'),
      summary: text(body, 'summary'),
      description: text(body, 'description'),
      specs: listFromBody(body.specs).map((row) => ({ label: text(row, 'label'), value: text(row, 'value') })),
      images: listFromBody(body.images).flatMap((row) => {
        const image = known.get(text(row, 'src'));
        return image ? [{ ...image, alt: text(row, 'alt') }] : [];
      }),
      featured: Boolean(body.featured),
      status: body.published ? 'published' : 'draft',
      sort: Number.parseInt(text(body, 'sort'), 10) || 0,
      seo: seoFromBody(body)
    };
  }

  private static async renderForm(res: Response, id: number | null, product: Product, error?: string, errors?: Record<string, string>): Promise<void> {
    if (error) {
      res.status(422);
    }
    const options = await productsAdminService.options();
    render(res, 'catalog/product-edit', {
      pageTitle: id === null ? 'Create Product' : `Edit: ${product.name}`,
      breadcrumbs: [{ text: 'Products', url: '/admin/products' }],
      isCreate: id === null,
      product,
      options,
      publicUrl: id === null ? '' : await productsAdminService.urlFor(product),
      specsMax: PRODUCT_SPECS_MAX,
      imagesMax: PRODUCT_IMAGES_MAX,
      includeCustomEditor: true,
      error: error ?? null,
      errors: errors ?? {}
    });
  }
}
