import type { Request, Response } from 'express';
import type { Settings } from '../domain/models.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { parseOrThrow, safeParseFields } from '../middleware/validate.js';
import { brandSlugParamsSchema, catalogPageQuerySchema, catalogSlugParamsSchema, productEnquirySchema } from '../schemas/publicSchemas.js';
import { BRANDS_BASE, PRODUCTS_BASE, catalogService, type ProductView } from '../services/catalogService.js';
import { contactService } from '../services/contactService.js';
import { excerpt } from '../services/sanitizeService.js';

const RELATED_LIMIT = 8;

export interface EnquiryFormState {
  values: Record<string, string>;
  errors: Record<string, string>;
  sent: boolean;
  message: string;
}

function emptyEnquiry(sent: boolean): EnquiryFormState {
  return { values: {}, errors: {}, sent, message: '' };
}

function wantsJson(req: Request): boolean {
  return (req.get('accept') ?? '').includes('application/json');
}

function applySeo(
  res: Response,
  title: string,
  description: string,
  image: string,
  override?: { title: string; description: string; keywords: string },
  canonicalPath?: string
): void {
  const settings = res.locals.settings as Settings;
  const seo = res.locals.seo as Record<string, string>;
  res.locals.seo = {
    ...seo,
    title: override?.title || `${title} | ${settings.siteName}`,
    description: override?.description || description || seo.description,
    keywords: override?.keywords || seo.keywords,
    image: image || seo.image,
    canonical: canonicalPath ? `${res.locals.baseUrl as string}${canonicalPath}` : seo.canonical
  };
}

function productJsonLd(product: ProductView, baseUrl: string, siteName: string): string {
  const absolute = (url: string): string => (url.startsWith('http') ? url : `${baseUrl}${url}`);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.model ? { sku: product.model, mpn: product.model } : {}),
    description: product.summary || excerpt(product.description, 300) || product.tagline,
    image: product.images.map((image) => absolute(image.src)),
    category: product.category.name,
    url: absolute(product.url),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    seller: { '@type': 'Organization', name: siteName }
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export class CatalogController {
  public static async index(_req: Request, res: Response): Promise<void> {
    const { categories, brands } = await catalogService.getNavigation();
    applySeo(res, 'Products', 'Browse safes, vault doors, filing cabinets and security products by category.', categories[0]?.cover ?? '');
    res.render('catalog/index', {
      categories,
      brands,
      breadcrumbs: [{ title: 'Home', url: '/' }, { title: 'Products', url: PRODUCTS_BASE }],
      bodyClass: 'is-catalog'
    });
  }

  public static async category(req: Request, res: Response): Promise<void> {
    const { category: slug } = parseOrThrow(catalogSlugParamsSchema, req.params);
    const query = parseOrThrow(catalogPageQuerySchema, req.query);
    const category = await catalogService.findCategoryBySlug(slug.toLowerCase());
    if (!category) {
      throw new NotFoundError(`No product category exists at ${req.path}.`);
    }
    if (slug !== category.slug) {
      res.redirect(301, category.url);
      return;
    }
    const [brands, allCategories] = await Promise.all([catalogService.brandsInCategory(category.id), catalogService.getPublishedCategories()]);
    const activeBrand = query.brand ? (brands.find((brand) => brand.slug === query.brand) ?? null) : null;
    const listing = await catalogService.listProducts({ categoryId: category.id, brandId: activeBrand?.id, page: query.page });
    const pageUrl = (page: number): string => {
      const params = new URLSearchParams();
      if (activeBrand) {
        params.set('brand', activeBrand.slug);
      }
      if (page > 1) {
        params.set('page', String(page));
      }
      const search = params.toString();
      return search ? `${category.url}?${search}` : category.url;
    };
    applySeo(res, category.name, category.summary || excerpt(category.description, 160), category.cover, category.seo, pageUrl(listing.page));
    res.render('catalog/category', {
      category,
      categories: allCategories,
      brands,
      activeBrand,
      listing,
      pageUrl,
      breadcrumbs: [{ title: 'Home', url: '/' }, { title: 'Products', url: PRODUCTS_BASE }, { title: category.name, url: category.url }],
      bodyClass: 'is-catalog'
    });
  }

  public static async product(req: Request, res: Response): Promise<void> {
    const params = parseOrThrow(catalogSlugParamsSchema, req.params);
    const product = await catalogService.findProduct(params.category.toLowerCase(), (params.product ?? '').toLowerCase());
    if (!product) {
      throw new NotFoundError(`No product exists at ${req.path}.`);
    }
    if (req.path !== product.url) {
      res.redirect(301, product.url);
      return;
    }
    await CatalogController.renderProduct(req, res, product, emptyEnquiry(req.query.sent === '1'));
  }

  public static async brands(_req: Request, res: Response): Promise<void> {
    const brands = (await catalogService.getPublishedBrands()).filter((brand) => brand.productCount > 0 || brand.logo);
    applySeo(res, 'Our Brands', 'The safe and security brands distributed by Throne Trading in Lebanon.', brands.find((brand) => brand.logo)?.logo ?? '');
    res.render('catalog/brands', {
      brands,
      breadcrumbs: [{ title: 'Home', url: '/' }, { title: 'Brands', url: BRANDS_BASE }],
      bodyClass: 'is-catalog'
    });
  }

  public static async brand(req: Request, res: Response): Promise<void> {
    const { brand: slug } = parseOrThrow(brandSlugParamsSchema, req.params);
    const query = parseOrThrow(catalogPageQuerySchema, req.query);
    const brand = await catalogService.findBrandBySlug(slug.toLowerCase());
    if (!brand) {
      throw new NotFoundError(`No brand exists at ${req.path}.`);
    }
    if (slug !== brand.slug) {
      res.redirect(301, brand.url);
      return;
    }
    const [categories, listing] = await Promise.all([catalogService.categoriesForBrand(brand.id), catalogService.listProducts({ brandId: brand.id, page: query.page })]);
    const pageUrl = (page: number): string => (page > 1 ? `${brand.url}?page=${page}` : brand.url);
    applySeo(res, brand.name, brand.summary || excerpt(brand.description, 160), brand.logo, brand.seo, pageUrl(listing.page));
    res.render('catalog/brand', {
      brand,
      categories,
      listing,
      pageUrl,
      breadcrumbs: [{ title: 'Home', url: '/' }, { title: 'Brands', url: BRANDS_BASE }, { title: brand.name, url: brand.url }],
      bodyClass: 'is-catalog'
    });
  }

  public static legacyBrand(req: Request, res: Response): void {
    const { brand } = parseOrThrow(brandSlugParamsSchema, req.params);
    res.redirect(301, `${BRANDS_BASE}/${brand.toLowerCase()}`);
  }

  public static async enquire(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(productEnquirySchema, req.body);
    if (!parsed.ok) {
      await CatalogController.respondWithErrors(req, res, parsed.fields);
      return;
    }
    let productUrl: string;
    try {
      ({ productUrl } = await contactService.submitProductEnquiry(parsed.data, { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' }));
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        await CatalogController.respondWithErrors(req, res, error.fields);
        return;
      }
      throw error;
    }
    const settings = res.locals.settings as Settings;
    if (wantsJson(req)) {
      res.json({ success: true, message: settings.thankYouMessage });
      return;
    }
    res.redirect(303, `${productUrl}?sent=1#enquiry`);
  }

  private static async respondWithErrors(req: Request, res: Response, fields: Record<string, string>): Promise<void> {
    const message = 'Please correct the highlighted fields.';
    if (wantsJson(req)) {
      res.status(422).json({ success: false, message, fields });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const productId = Number.parseInt(typeof body.productId === 'string' ? body.productId : '', 10);
    const product = Number.isInteger(productId) && productId > 0 ? await catalogService.findPublishedProductById(productId) : null;
    if (!product) {
      throw new NotFoundError('This product is no longer available.');
    }
    const values: Record<string, string> = {};
    for (const key of ['name', 'email', 'company', 'phone', 'message']) {
      const value = body[key];
      values[key] = typeof value === 'string' ? value : '';
    }
    res.status(422);
    await CatalogController.renderProduct(req, res, product, { values, errors: fields, sent: false, message });
  }

  private static async renderProduct(_req: Request, res: Response, product: ProductView, enquiry: EnquiryFormState): Promise<void> {
    const related = await catalogService.relatedProducts(product, RELATED_LIMIT);
    const settings = res.locals.settings as Settings;
    const cover = product.images[0]?.src ?? '';
    applySeo(res, product.model ? `${product.name} ${product.model}` : product.name, product.summary || product.tagline || excerpt(product.description, 160), cover, product.seo);
    res.render('catalog/product', {
      product,
      related,
      enquiry,
      jsonLd: productJsonLd(product, res.locals.baseUrl as string, settings.siteName),
      breadcrumbs: [
        { title: 'Home', url: '/' },
        { title: 'Products', url: PRODUCTS_BASE },
        { title: product.category.name, url: product.category.url },
        { title: product.name, url: product.url }
      ],
      bodyClass: 'is-product'
    });
  }
}
