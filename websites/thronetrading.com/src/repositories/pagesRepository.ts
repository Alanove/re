import { DATA_FILES } from '../config/paths.js';
import { pagesFileSchema, type Page } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class PagesRepository {
  private readonly store = new JsonFileStore<Page[]>(DATA_FILES.pages, pagesFileSchema, () => []);

  public async findAll(): Promise<Page[]> {
    return this.store.read();
  }

  public async findById(id: number): Promise<Page | null> {
    const pages = await this.store.read();
    return pages.find((page) => page.id === id) ?? null;
  }

  public async findByKey(key: string): Promise<Page | null> {
    const pages = await this.store.read();
    return pages.find((page) => page.key === key) ?? null;
  }

  public async insert(page: Omit<Page, 'id'>): Promise<Page> {
    return this.store.update((pages) => {
      const id = pages.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const created: Page = { ...page, id };
      return { next: [...pages, created], result: created };
    });
  }

  public async replace(page: Page): Promise<Page> {
    return this.store.update((pages) => {
      const index = pages.findIndex((item) => item.id === page.id);
      if (index === -1) {
        throw new Error(`Page ${page.id} does not exist`);
      }
      const next = [...pages];
      next[index] = page;
      return { next, result: page };
    });
  }

  public async remove(id: number): Promise<boolean> {
    return this.store.update((pages) => {
      const next = pages.filter((page) => page.id !== id);
      return { next, result: next.length !== pages.length };
    });
  }
}

export const pagesRepository = new PagesRepository();
