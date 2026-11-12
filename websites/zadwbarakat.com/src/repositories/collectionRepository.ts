import type { z } from 'zod';
import { JsonFileStore } from './jsonFileStore.js';

/** A JSON array file of records with numeric ids (sections, books, hymns, albums, videos, purchases). */
export class CollectionRepository<T extends { id: number }> {
  private readonly store: JsonFileStore<T[]>;

  constructor(filePath: string, schema: z.ZodType<T[]>) {
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
      const created = { ...item, id: items.reduce((max, entry) => Math.max(max, entry.id), 0) + 1 } as T;
      return { next: [...items, created], result: created };
    });
  }

  public async replace(item: T): Promise<T> {
    return this.store.update((items) => {
      if (!items.some((entry) => entry.id === item.id)) {
        throw new Error(`Record ${item.id} does not exist`);
      }
      return { next: items.map((entry) => (entry.id === item.id ? item : entry)), result: item };
    });
  }

  public async remove(id: number): Promise<T | null> {
    return this.store.update((items) => ({
      next: items.filter((entry) => entry.id !== id),
      result: items.find((entry) => entry.id === id) ?? null
    }));
  }

  public async replaceAll(items: T[]): Promise<void> {
    await this.store.write(items);
  }
}
