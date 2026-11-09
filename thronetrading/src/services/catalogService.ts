import { thumbUrl } from '../domain/media.js';
import type { Brand, Category, Product, ProductImage, ProductSpec } from '../domain/models.js';
import { brandsRepository, categoriesRepository, productsRepository } from '../repositories/catalogRepositories.js';

export const PRODUCTS_BASE = '/products';
export const BRANDS_BASE = '/brands';
export const PRODUCTS_PER_PAGE = 24;

export const categoryUrl = (slug: string): string => `${PRODUCTS_BASE}/${slug}`;
export const productUrl = (categorySlug: string, slug: string): string => `${PRODUCTS_BASE}/${categorySlug}/${slug}`;
export const brandUrl = (slug: string): string => `${BRANDS_BASE}/${slug}`;

export interface CategoryView extends Category {
  url: string;
  productCount: number;
  cover: string;
  coverThumb: string;
}

export interface BrandView extends Brand {
  url: string;
  productCount: number;
}

export interface ProductCard {
  id: number;
  name: string;
  model: string;
  tagline: string;
  summary: string;
  keySpec: ProductSpec | null;
  url: string;
  image: ProductImage | null;
  thumb: string;
  featured: boolean;
  category: { id: number; name: string; url: string };
  brand: { id: number; name: string; url: string; logo: string } | null;
}

export interface ProductView extends Product {
  url: string;
  category: CategoryView;
  brand: BrandView | null;
}

export interface ProductPage {
  items: ProductCard[];
  total: number;
  page: number;
  pages: number;
}

interface Snapshot {
  categories: Category[];
  brands: Brand[];
  products: Product[];
}

const bySortThenName = <T extends { sort: number; name: string }>(a: T, b: T): number => a.sort - b.sort || a.name.localeCompare(b.name);

const countBy = <K>(keys: K[]): Map<K, number> => {
  const counts = new Map<K, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

export class CatalogService {
  public async getNavigation(): Promise<{ categories: CategoryView[]; brands: BrandView[] }> {
    const snapshot = await this.publishedSnapshot();
    return { categories: this.categoryViews(snapshot), brands: this.brandViews(snapshot) };
  }

  public async getPublishedCategories(): Promise<CategoryView[]> {
    return this.categoryViews(await this.publishedSnapshot());
  }

  public async getPublishedBrands(): Promise<BrandView[]> {
    return this.brandViews(await this.publishedSnapshot());
  }

  public async findCategoryBySlug(slug: string): Promise<CategoryView | null> {
    const snapshot = await this.publishedSnapshot();
    return this.categoryViews(snapshot).find((category) => category.slug === slug) ?? null;
  }

  public async findBrandBySlug(slug: string): Promise<BrandView | null> {
    const snapshot = await this.publishedSnapshot();
    return this.brandViews(snapshot).find((brand) => brand.slug === slug) ?? null;
  }

  public async findProduct(categorySlug: string, productSlug: string): Promise<ProductView | null> {
    const snapshot = await this.publishedSnapshot();
    const category = this.categoryViews(snapshot).find((item) => item.slug === categorySlug);
    if (!category) {
      return null;
    }
    const product = snapshot.products.find((item) => item.categoryId === category.id && item.slug === productSlug);
    if (!product) {
      return null;
    }
    const brand = product.brandId === null ? null : (this.brandViews(snapshot).find((item) => item.id === product.brandId) ?? null);
    return { ...product, url: productUrl(category.slug, product.slug), category, brand };
  }

  public async findPublishedProductById(id: number): Promise<ProductView | null> {
    const snapshot = await this.publishedSnapshot();
    const product = snapshot.products.find((item) => item.id === id);
    const category = product ? snapshot.categories.find((item) => item.id === product.categoryId) : undefined;
    return product && category ? this.findProduct(category.slug, product.slug) : null;
  }

  public async listProducts(filter: { categoryId?: number; brandId?: number; page?: number; perPage?: number }): Promise<ProductPage> {
    const snapshot = await this.publishedSnapshot();
    const matches = snapshot.products
      .filter((product) => filter.categoryId === undefined || product.categoryId === filter.categoryId)
      .filter((product) => filter.brandId === undefined || product.brandId === filter.brandId)
      .sort(bySortThenName);
    const perPage = filter.perPage ?? PRODUCTS_PER_PAGE;
    const pages = Math.max(1, Math.ceil(matches.length / perPage));
    const page = Math.min(Math.max(1, filter.page ?? 1), pages);
    const items = matches.slice((page - 1) * perPage, page * perPage).map((product) => this.toCard(product, snapshot));
    return { items, total: matches.length, page, pages };
  }

  public async brandsInCategory(categoryId: number): Promise<BrandView[]> {
    const snapshot = await this.publishedSnapshot();
    const counts = countBy(snapshot.products.filter((product) => product.categoryId === categoryId).map((product) => product.brandId));
    return this.brandViews(snapshot)
      .filter((brand) => counts.has(brand.id))
      .map((brand) => ({ ...brand, productCount: counts.get(brand.id) ?? 0 }));
  }

  public async categoriesForBrand(brandId: number): Promise<CategoryView[]> {
    const snapshot = await this.publishedSnapshot();
    const counts = countBy(snapshot.products.filter((product) => product.brandId === brandId).map((product) => product.categoryId));
    return this.categoryViews(snapshot)
      .filter((category) => counts.has(category.id))
      .map((category) => ({ ...category, productCount: counts.get(category.id) ?? 0 }));
  }

  public async relatedProducts(product: ProductView, limit: number): Promise<ProductCard[]> {
    const snapshot = await this.publishedSnapshot();
    const sameCategory = snapshot.products.filter((item) => item.id !== product.id && item.categoryId === product.categoryId);
    const score = (item: Product): number => (product.brandId !== null && item.brandId === product.brandId ? 0 : 1);
    return sameCategory
      .sort((a, b) => score(a) - score(b) || bySortThenName(a, b))
      .slice(0, limit)
      .map((item) => this.toCard(item, snapshot));
  }

  public async featuredProducts(limit: number): Promise<ProductCard[]> {
    const snapshot = await this.publishedSnapshot();
    const featured = snapshot.products.filter((product) => product.featured).sort(bySortThenName);
    const fallback = snapshot.products.filter((product) => !product.featured && product.images.length > 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return [...featured, ...fallback].slice(0, limit).map((product) => this.toCard(product, snapshot));
  }

  public async sitemapUrls(): Promise<string[]> {
    const snapshot = await this.publishedSnapshot();
    const categories = this.categoryViews(snapshot);
    const categorySlugs = new Map(categories.map((category) => [category.id, category.slug]));
    return [
      PRODUCTS_BASE,
      BRANDS_BASE,
      ...categories.map((category) => category.url),
      ...this.brandViews(snapshot).map((brand) => brand.url),
      ...snapshot.products.flatMap((product) => {
        const categorySlug = categorySlugs.get(product.categoryId);
        return categorySlug ? [productUrl(categorySlug, product.slug)] : [];
      })
    ];
  }

  private async publishedSnapshot(): Promise<Snapshot> {
    const [categories, brands, products] = await Promise.all([categoriesRepository.findAll(), brandsRepository.findAll(), productsRepository.findAll()]);
    const liveCategories = categories.filter((category) => category.status === 'published');
    const liveCategoryIds = new Set(liveCategories.map((category) => category.id));
    const liveBrands = brands.filter((brand) => brand.status === 'published');
    const liveBrandIds = new Set(liveBrands.map((brand) => brand.id));
    return {
      categories: liveCategories,
      brands: liveBrands,
      products: products
        .filter((product) => product.status === 'published' && liveCategoryIds.has(product.categoryId))
        .map((product) => (product.brandId !== null && !liveBrandIds.has(product.brandId) ? { ...product, brandId: null } : product))
    };
  }

  private categoryViews(snapshot: Snapshot): CategoryView[] {
    return [...snapshot.categories].sort(bySortThenName).map((category) => {
      const products = snapshot.products.filter((product) => product.categoryId === category.id).sort(bySortThenName);
      const cover = category.image || products.find((product) => product.images.length > 0)?.images[0]?.src || '';
      return { ...category, url: categoryUrl(category.slug), productCount: products.length, cover, coverThumb: thumbUrl(cover) };
    });
  }

  private brandViews(snapshot: Snapshot): BrandView[] {
    return [...snapshot.brands].sort(bySortThenName).map((brand) => ({
      ...brand,
      url: brandUrl(brand.slug),
      productCount: snapshot.products.filter((product) => product.brandId === brand.id).length
    }));
  }

  private toCard(product: Product, snapshot: Snapshot): ProductCard {
    const category = snapshot.categories.find((item) => item.id === product.categoryId);
    const brand = product.brandId === null ? undefined : snapshot.brands.find((item) => item.id === product.brandId);
    const image = product.images[0] ?? null;
    const categorySlug = category?.slug ?? '';
    return {
      id: product.id,
      name: product.name,
      model: product.model,
      tagline: product.tagline,
      summary: product.summary,
      keySpec: product.specs[0] ?? null,
      url: productUrl(categorySlug, product.slug),
      image,
      thumb: image ? thumbUrl(image.src) : '',
      featured: product.featured,
      category: { id: category?.id ?? 0, name: category?.name ?? '', url: categoryUrl(categorySlug) },
      brand: brand ? { id: brand.id, name: brand.name, url: brandUrl(brand.slug), logo: brand.logo } : null
    };
  }
}

export const catalogService = new CatalogService();
