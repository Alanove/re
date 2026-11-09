import { PRODUCT_IMAGES_MAX, type Brand, type Category, type Product, type ProductImage } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/httpError.js';
import { brandsRepository, categoriesRepository, productsRepository, redirectsRepository } from '../repositories/catalogRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { BrandFormInput, CategoryFormInput, ProductFormInput } from '../schemas/adminSchemas.js';
import { brandUrl, categoryUrl, productUrl } from './catalogService.js';
import type { UploadedImage } from './pagesService.js';
import { sanitizeRichText, slugify } from './sanitizeService.js';

const RESERVED_CATEGORY_SLUGS = new Set(['brands']);

export interface AdminProductRow extends Product {
  categoryName: string;
  brandName: string;
  url: string;
}

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

async function removeIfOwned(url: string): Promise<void> {
  if (url && isOwnedUpload(url)) {
    await mediaRepository.remove(url);
  }
}

function seoFrom(input: { seoTitle: string; seoDescription: string; seoKeywords: string }): Product['seo'] {
  return { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords };
}

function requireSlug(input: { slug: string; name: string }): string {
  const slug = input.slug || slugify(input.name);
  if (!slug) {
    throw new BadRequestError('Please correct the highlighted fields.', { slug: 'Enter a slug using letters or numbers' });
  }
  return slug;
}

export class CategoriesAdminService {
  public async list(): Promise<(Category & { productCount: number; url: string })[]> {
    const [categories, products] = await Promise.all([categoriesRepository.findAll(), productsRepository.findAll()]);
    return categories
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        url: categoryUrl(category.slug),
        productCount: products.filter((product) => product.categoryId === category.id).length
      }));
  }

  public async get(id: number): Promise<Category> {
    const category = await categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }
    return category;
  }

  public async create(input: CategoryFormInput, image: UploadedImage | null): Promise<Category> {
    const slug = requireSlug(input);
    await this.assertSlug(slug, null);
    const now = new Date().toISOString();
    return categoriesRepository.insert({
      slug,
      name: input.name,
      summary: input.summary,
      description: sanitizeRichText(input.description),
      image: image?.url ?? input.image,
      icon: input.icon,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: seoFrom(input),
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: CategoryFormInput, image: UploadedImage | null): Promise<Category> {
    const existing = await this.get(id);
    const slug = input.slug || existing.slug;
    await this.assertSlug(slug, id);
    const nextImage = image?.url ?? input.image;
    if (existing.image !== nextImage) {
      await removeIfOwned(existing.image);
    }
    const saved = await categoriesRepository.replace({
      ...existing,
      slug,
      name: input.name,
      summary: input.summary,
      description: sanitizeRichText(input.description),
      image: nextImage,
      icon: input.icon,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: seoFrom(input),
      updatedAt: new Date().toISOString()
    });
    if (existing.slug !== slug) {
      await redirectsRepository.upsert(categoryUrl(existing.slug), categoryUrl(slug));
      const products = (await productsRepository.findAll()).filter((product) => product.categoryId === id);
      for (const product of products) {
        await redirectsRepository.upsert(productUrl(existing.slug, product.slug), productUrl(slug, product.slug));
      }
    }
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const existing = await this.get(id);
    const products = await productsRepository.findAll();
    if (products.some((product) => product.categoryId === id)) {
      throw new ConflictError('Move or delete the products in this category first.');
    }
    await removeIfOwned(existing.image);
    await categoriesRepository.remove(id);
  }

  public async isSlugAvailable(slug: string, excludeId: number | null): Promise<boolean> {
    if (RESERVED_CATEGORY_SLUGS.has(slug)) {
      return false;
    }
    const categories = await categoriesRepository.findAll();
    return !categories.some((category) => category.slug === slug && category.id !== excludeId);
  }

  private async assertSlug(slug: string, selfId: number | null): Promise<void> {
    if (!(await this.isSlugAvailable(slug, selfId))) {
      throw new ConflictError('Please correct the highlighted fields.', {
        slug: RESERVED_CATEGORY_SLUGS.has(slug) ? 'This slug is reserved' : 'Another category uses this slug'
      });
    }
  }
}

export class BrandsAdminService {
  public async list(): Promise<(Brand & { productCount: number; url: string })[]> {
    const [brands, products] = await Promise.all([brandsRepository.findAll(), productsRepository.findAll()]);
    return brands
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((brand) => ({ ...brand, url: brandUrl(brand.slug), productCount: products.filter((product) => product.brandId === brand.id).length }));
  }

  public async get(id: number): Promise<Brand> {
    const brand = await brandsRepository.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found.');
    }
    return brand;
  }

  public async create(input: BrandFormInput, logo: UploadedImage | null): Promise<Brand> {
    const slug = requireSlug(input);
    await this.assertSlug(slug, null);
    const now = new Date().toISOString();
    return brandsRepository.insert({
      slug,
      name: input.name,
      logo: logo?.url ?? input.logo,
      summary: input.summary,
      description: sanitizeRichText(input.description),
      website: input.website,
      status: input.published ? 'published' : 'draft',
      featured: input.featured,
      sort: input.sort,
      seo: seoFrom(input),
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: BrandFormInput, logo: UploadedImage | null): Promise<Brand> {
    const existing = await this.get(id);
    const slug = input.slug || existing.slug;
    await this.assertSlug(slug, id);
    const nextLogo = logo?.url ?? input.logo;
    if (existing.logo !== nextLogo) {
      await removeIfOwned(existing.logo);
    }
    const saved = await brandsRepository.replace({
      ...existing,
      slug,
      name: input.name,
      logo: nextLogo,
      summary: input.summary,
      description: sanitizeRichText(input.description),
      website: input.website,
      status: input.published ? 'published' : 'draft',
      featured: input.featured,
      sort: input.sort,
      seo: seoFrom(input),
      updatedAt: new Date().toISOString()
    });
    if (existing.slug !== slug) {
      await redirectsRepository.upsert(brandUrl(existing.slug), brandUrl(slug));
    }
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const existing = await this.get(id);
    await productsRepository.updateMany((products) => products.map((product) => (product.brandId === id ? { ...product, brandId: null } : product)));
    await removeIfOwned(existing.logo);
    await brandsRepository.remove(id);
  }

  public async isSlugAvailable(slug: string, excludeId: number | null): Promise<boolean> {
    const brands = await brandsRepository.findAll();
    return !brands.some((brand) => brand.slug === slug && brand.id !== excludeId);
  }

  private async assertSlug(slug: string, selfId: number | null): Promise<void> {
    if (!(await this.isSlugAvailable(slug, selfId))) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another brand uses this slug' });
    }
  }
}

export class ProductsAdminService {
  public async list(filter: { q: string; category: number | null; brand: number | 'none' | null; status?: 'published' | 'draft' }): Promise<AdminProductRow[]> {
    const [products, categories, brands] = await Promise.all([productsRepository.findAll(), categoriesRepository.findAll(), brandsRepository.findAll()]);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const query = filter.q.toLowerCase();
    return products
      .filter((product) => filter.category === null || product.categoryId === filter.category)
      .filter((product) => filter.brand === null || (filter.brand === 'none' ? product.brandId === null : product.brandId === filter.brand))
      .filter((product) => !filter.status || product.status === filter.status)
      .filter((product) => query === '' || `${product.name} ${product.model} ${product.slug}`.toLowerCase().includes(query))
      .sort((a, b) => (categoryById.get(a.categoryId)?.sort ?? 0) - (categoryById.get(b.categoryId)?.sort ?? 0) || a.sort - b.sort || a.name.localeCompare(b.name))
      .map((product) => {
        const category = categoryById.get(product.categoryId);
        return {
          ...product,
          categoryName: category?.name ?? '—',
          brandName: product.brandId === null ? '' : (brandById.get(product.brandId)?.name ?? ''),
          url: category ? productUrl(category.slug, product.slug) : ''
        };
      });
  }

  public async get(id: number): Promise<Product> {
    const product = await productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }
    return product;
  }

  public async urlFor(product: Product): Promise<string> {
    const category = await categoriesRepository.findById(product.categoryId);
    return category ? productUrl(category.slug, product.slug) : '';
  }

  public async create(input: ProductFormInput, uploads: UploadedImage[]): Promise<Product> {
    await this.assertReferences(input);
    const slug = requireSlug(input);
    await this.assertSlug(slug, input.categoryId, null);
    const now = new Date().toISOString();
    return productsRepository.insert({
      slug,
      categoryId: input.categoryId,
      brandId: input.brandId,
      name: input.name,
      model: input.model,
      tagline: input.tagline,
      summary: input.summary,
      specs: input.specs,
      description: sanitizeRichText(input.description),
      images: this.appendUploads([], uploads, input.name),
      featured: input.featured,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: seoFrom(input),
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: ProductFormInput, uploads: UploadedImage[]): Promise<Product> {
    const existing = await this.get(id);
    await this.assertReferences(input);
    const slug = input.slug || existing.slug;
    await this.assertSlug(slug, input.categoryId, id);

    const known = new Map(existing.images.map((image) => [image.src, image]));
    const kept: (ProductImage & { sort: number })[] = [];
    for (const row of input.images) {
      const current = known.get(row.src);
      if (!current) {
        continue;
      }
      known.delete(row.src);
      if (row.remove) {
        await removeIfOwned(current.src);
      } else {
        kept.push({ ...current, alt: row.alt, sort: row.sort });
      }
    }
    const untouched = [...known.values()].map((image, index) => ({ ...image, sort: 1_000_000 + index }));
    const ordered = [...kept, ...untouched].sort((a, b) => a.sort - b.sort).map(({ sort: _sort, ...image }) => image);
    const images = this.appendUploads(ordered, uploads, input.name);
    if (images.length > PRODUCT_IMAGES_MAX) {
      throw new BadRequestError('Please correct the highlighted fields.', {
        images: `A product can have at most ${PRODUCT_IMAGES_MAX} images. Remove some before adding more.`
      });
    }

    const oldUrl = await this.urlFor(existing);
    const saved = await productsRepository.replace({
      ...existing,
      slug,
      categoryId: input.categoryId,
      brandId: input.brandId,
      name: input.name,
      model: input.model,
      tagline: input.tagline,
      summary: input.summary,
      specs: input.specs,
      description: sanitizeRichText(input.description),
      images,
      featured: input.featured,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: seoFrom(input),
      updatedAt: new Date().toISOString()
    });
    const newUrl = await this.urlFor(saved);
    if (oldUrl && newUrl && oldUrl !== newUrl) {
      await redirectsRepository.upsert(oldUrl, newUrl);
    }
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const existing = await this.get(id);
    for (const image of existing.images) {
      await removeIfOwned(image.src);
    }
    await productsRepository.remove(id);
  }

  public async isSlugAvailable(slug: string, categoryId: number | null, excludeId: number | null): Promise<boolean> {
    const products = await productsRepository.findAll();
    return !products.some((product) => product.slug === slug && product.categoryId === categoryId && product.id !== excludeId);
  }

  public async options(): Promise<{ categories: { id: number; label: string }[]; brands: { id: number; label: string }[] }> {
    const [categories, brands] = await Promise.all([categoriesRepository.findAll(), brandsRepository.findAll()]);
    const sorted = <T extends { sort: number; name: string }>(items: T[]): T[] => [...items].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    return {
      categories: sorted(categories).map((category) => ({ id: category.id, label: category.status === 'draft' ? `${category.name} (draft)` : category.name })),
      brands: sorted(brands).map((brand) => ({ id: brand.id, label: brand.status === 'draft' ? `${brand.name} (draft)` : brand.name }))
    };
  }

  private appendUploads(images: ProductImage[], uploads: UploadedImage[], name: string): ProductImage[] {
    return [...images, ...uploads.map((upload) => ({ src: upload.url, alt: name, width: upload.width, height: upload.height }))];
  }

  private async assertReferences(input: ProductFormInput): Promise<void> {
    if (!(await categoriesRepository.findById(input.categoryId))) {
      throw new BadRequestError('Please correct the highlighted fields.', { categoryId: 'Choose an existing category' });
    }
    if (input.brandId !== null && !(await brandsRepository.findById(input.brandId))) {
      throw new BadRequestError('Please correct the highlighted fields.', { brandId: 'Choose an existing brand' });
    }
  }

  private async assertSlug(slug: string, categoryId: number, selfId: number | null): Promise<void> {
    if (!(await this.isSlugAvailable(slug, categoryId, selfId))) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another product in this category uses this slug' });
    }
  }
}

export const categoriesAdminService = new CategoriesAdminService();
export const brandsAdminService = new BrandsAdminService();
export const productsAdminService = new ProductsAdminService();
