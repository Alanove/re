import type { z } from 'zod';
import { DATA_FILES } from '../config/paths.js';
import {
  brandsFileSchema,
  categoriesFileSchema,
  productsFileSchema,
  redirectsFileSchema,
  type Brand,
  type Category,
  type Product,
  type Redirect
} from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

class IdCollectionRepository<T extends { id: number }> {
  private readonly store: JsonFileStore<T[]>;

  constructor(
    filePath: string,
    schema: z.ZodType<T[]>,
    private readonly label: string
  ) {
    this.store = new JsonFileStore<T[]>(filePath, schema, () => []);
  }

  public async findAll(): Promise<T[]> {
    return this.store.read();
  }

  public async findById(id: number): Promise<T | null> {
    const items = await this.store.read();
    return items.find((item) => item.id === id) ?? null;
  }

  public async insert(item: Omit<T, 'id'>): Promise<T> {
    return this.store.update((items) => {
      const id = items.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
      const created = { ...item, id } as T;
      return { next: [...items, created], result: created };
    });
  }

  public async replace(item: T): Promise<T> {
    return this.store.update((items) => {
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index === -1) {
        throw new Error(`${this.label} ${item.id} does not exist`);
      }
      const next = [...items];
      next[index] = item;
      return { next, result: item };
    });
  }

  public async remove(id: number): Promise<T | null> {
    return this.store.update((items) => {
      const target = items.find((entry) => entry.id === id) ?? null;
      return { next: items.filter((entry) => entry.id !== id), result: target };
    });
  }

  public async updateMany(mutator: (items: T[]) => T[]): Promise<void> {
    await this.store.update((items) => ({ next: mutator(items), result: undefined }));
  }
}

export const brandsRepository = new IdCollectionRepository<Brand>(DATA_FILES.brands, brandsFileSchema, 'Brand');
export const categoriesRepository = new IdCollectionRepository<Category>(DATA_FILES.categories, categoriesFileSchema, 'Category');
export const productsRepository = new IdCollectionRepository<Product>(DATA_FILES.products, productsFileSchema, 'Product');

export class RedirectsRepository {
  private readonly store = new JsonFileStore<Redirect[]>(DATA_FILES.redirects, redirectsFileSchema, () => []);

  public async findAll(): Promise<Redirect[]> {
    return this.store.read();
  }

  public async upsert(from: string, to: string): Promise<void> {
    await this.store.update((items) => {
      const rest = items.filter((item) => item.from !== from && item.from !== to);
      const retargeted = rest.map((item) => (item.to === from ? { ...item, to } : item));
      return { next: from === to ? retargeted : [...retargeted, { from, to }], result: undefined };
    });
  }
}

export const redirectsRepository = new RedirectsRepository();
