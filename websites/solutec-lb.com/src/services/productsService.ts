import * as fs from 'fs';
import { DATA_PATHS } from '../constants';

export interface ProductCategory {
  key: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sort?: number;
  showOnHome?: boolean;
  status?: 'active' | 'hidden';
}

export interface ProductRecord {
  key: string;
  title: string;
  url: string;
  sku?: string;
  price?: string;
  excerpt?: string;
  content?: string;
  image?: string;
  gallery?: string[];
  pdf?: string;
  categories: string[];
  status?: 'published' | 'draft';
  seo?: {
    pageTitle?: string;
    pageDescription?: string;
    pageKeywords?: string;
    pageImage?: string;
    pageType?: string;
  };
}

const SPECS_HEADING = 'Product Technical Specifications';

export function presentProductBody(html: string, storedPdf = ''): { content: string; pdf: string } {
  let extracted = '';
  let content = String(html || '').replace(
    /<p\b[^>]*\bclass=["'][^"']*\bspacer\b[^"']*["'][^>]*>\s*<a\b([^>]*)>\s*Download PDF\s*<\/a>\s*<\/p>/gi,
    (_match, attrs: string) => {
      const href = (String(attrs).match(/\bhref=["']([^"']+)["']/i) || [])[1] || '';
      if (href && !extracted) extracted = href;
      return '';
    }
  );
  content = content.replace(/^(?:\s|&nbsp;|<br\s*\/?>|<(?:p|div)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/(?:p|div)>)+/gi, '');
  content = content.replace(new RegExp(`^\\s*<(?:h[1-6]|p)\\b[^>]*>(?:\\s|<(?:strong|b)>|</(?:strong|b)>)*${SPECS_HEADING}(?:\\s|<(?:strong|b)>|</(?:strong|b)>)*</(?:h[1-6]|p)>\\s*`, 'i'), '');
  return { content: content.trim(), pdf: storedPdf.trim() || extracted };
}

class ProductsService {
  getCategories(): ProductCategory[] {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_PATHS.PRODUCT_CATEGORIES_FILE, 'utf8'));
      return (data.categories || [])
        .filter((category: ProductCategory) => category.status !== 'hidden')
        .sort((a: ProductCategory, b: ProductCategory) => (a.sort || 0) - (b.sort || 0));
    } catch {
      return [];
    }
  }

  getHomeCategories(): ProductCategory[] {
    return this.getCategories().filter((category) => category.showOnHome !== false);
  }

  getCategory(slug: string): ProductCategory | null {
    return this.getCategories().find((category) => category.slug === slug) || null;
  }

  getProducts(): ProductRecord[] {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_PATHS.PRODUCTS_FILE, 'utf8'));
      return Object.values(data.products || {}) as ProductRecord[];
    } catch {
      return [];
    }
  }

  getPublished(): ProductRecord[] {
    return this.getProducts().filter((product) => product.status !== 'draft');
  }

  getPublishedSorted(): ProductRecord[] {
    return this.getPublished().slice().sort((a, b) => a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: 'base'
    }));
  }

  getByKey(key: string): ProductRecord | null {
    return this.getPublished().find((product) => product.key === key) || null;
  }

  getByCategory(slug: string): ProductRecord[] {
    return this.getPublishedSorted().filter((product) => (product.categories || []).includes(slug));
  }

  getCategoriesWithCounts(): Array<ProductCategory & { count: number }> {
    const products = this.getPublished();
    return this.getCategories().map((category) => ({
      ...category,
      count: products.filter((product) => (product.categories || []).includes(category.slug)).length
    }));
  }
}

export default new ProductsService();
