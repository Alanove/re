import { DATA_FILES } from '../config/paths.js';
import { redirectsFileSchema, type Redirect } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

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
