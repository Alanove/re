import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { ProductCategory, ProductRecord } from '../../src/services/productsService';

interface ProductsFile {
  products: Record<string, ProductRecord>;
}

interface CategoriesFile {
  categories: ProductCategory[];
}

export class CatalogAdminService {
  private static instance: CatalogAdminService;

  public static getInstance(): CatalogAdminService {
    if (!CatalogAdminService.instance) CatalogAdminService.instance = new CatalogAdminService();
    return CatalogAdminService.instance;
  }

  private readProducts(): ProductsFile {
    try {
      return JSON.parse(fs.readFileSync(DATA_PATHS.PRODUCTS_FILE, 'utf8'));
    } catch {
      return { products: {} };
    }
  }

  private writeProducts(data: ProductsFile): void {
    fs.writeFileSync(DATA_PATHS.PRODUCTS_FILE, JSON.stringify(data, null, 2));
  }

  private readCategories(): CategoriesFile {
    try {
      return JSON.parse(fs.readFileSync(DATA_PATHS.PRODUCT_CATEGORIES_FILE, 'utf8'));
    } catch {
      return { categories: [] };
    }
  }

  private writeCategories(data: CategoriesFile): void {
    fs.writeFileSync(DATA_PATHS.PRODUCT_CATEGORIES_FILE, JSON.stringify(data, null, 2));
  }

  getProducts(): ProductRecord[] {
    return Object.values(this.readProducts().products);
  }

  getProduct(key: string): ProductRecord | null {
    return this.readProducts().products[key] || null;
  }

  saveProduct(product: ProductRecord): void {
    const data = this.readProducts();
    data.products[product.key] = product;
    this.writeProducts(data);
  }

  deleteProduct(key: string): void {
    const data = this.readProducts();
    delete data.products[key];
    this.writeProducts(data);
  }

  getCategories(): ProductCategory[] {
    return this.readCategories().categories;
  }

  getCategory(slug: string): ProductCategory | null {
    return this.getCategories().find((category) => category.slug === slug) || null;
  }

  saveCategory(category: ProductCategory): void {
    const data = this.readCategories();
    const index = data.categories.findIndex((item) => item.slug === category.slug || item.key === category.key);
    if (index >= 0) data.categories[index] = category;
    else data.categories.push(category);
    this.writeCategories(data);
  }

  getProductsInCategory(slug: string): ProductRecord[] {
    return this.getProducts().filter((product) => (product.categories || []).includes(slug));
  }

  deleteCategory(slug: string): boolean {
    if (this.getProductsInCategory(slug).length > 0) return false;
    const data = this.readCategories();
    data.categories = data.categories.filter((category) => category.slug !== slug);
    this.writeCategories(data);
    return true;
  }

  setCategoryStatus(slug: string, status: 'active' | 'hidden'): boolean {
    const data = this.readCategories();
    const category = data.categories.find((item) => item.slug === slug);
    if (!category) return false;
    category.status = status;
    this.writeCategories(data);
    return true;
  }
}
