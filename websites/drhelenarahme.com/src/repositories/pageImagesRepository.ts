import { DATA_FILES } from '../config/paths.js';
import { pageImagesFileSchema, type PageImage } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class PageImagesRepository {
  private readonly store = new JsonFileStore<PageImage[]>(DATA_FILES.pageImages, pageImagesFileSchema, () => []);

  public async findByPage(pageId: number): Promise<PageImage[]> {
    const images = await this.store.read();
    return images.filter((image) => image.pageId === pageId).sort((a, b) => a.sort - b.sort || a.id - b.id);
  }

  public async countByPage(): Promise<Map<number, number>> {
    const images = await this.store.read();
    const counts = new Map<number, number>();
    for (const image of images) {
      counts.set(image.pageId, (counts.get(image.pageId) ?? 0) + 1);
    }
    return counts;
  }

  public async findAll(): Promise<PageImage[]> {
    return this.store.read();
  }

  public async findById(id: number): Promise<PageImage | null> {
    const images = await this.store.read();
    return images.find((image) => image.id === id) ?? null;
  }

  public async insertMany(items: Omit<PageImage, 'id'>[]): Promise<PageImage[]> {
    return this.store.update((images) => {
      let nextId = images.reduce((max, item) => Math.max(max, item.id), 0);
      const created = items.map((item) => {
        nextId += 1;
        return { ...item, id: nextId };
      });
      return { next: [...images, ...created], result: created };
    });
  }

  public async updateCaptionsAndSort(pageId: number, changes: { id: number; caption: string; sort: number }[]): Promise<void> {
    await this.store.update((images) => {
      const byId = new Map(changes.map((change) => [change.id, change]));
      const next = images.map((image) => {
        const change = image.pageId === pageId ? byId.get(image.id) : undefined;
        return change ? { ...image, caption: change.caption, sort: change.sort } : image;
      });
      return { next, result: undefined };
    });
  }

  public async remove(id: number): Promise<PageImage | null> {
    return this.store.update((images) => {
      const target = images.find((image) => image.id === id) ?? null;
      return { next: images.filter((image) => image.id !== id), result: target };
    });
  }

  public async removeByPage(pageId: number): Promise<PageImage[]> {
    return this.store.update((images) => {
      const removed = images.filter((image) => image.pageId === pageId);
      return { next: images.filter((image) => image.pageId !== pageId), result: removed };
    });
  }
}

export const pageImagesRepository = new PageImagesRepository();
