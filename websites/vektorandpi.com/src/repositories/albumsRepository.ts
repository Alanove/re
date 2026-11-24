import { DATA_FILES } from '../config/paths.js';
import { albumsFileSchema, type Album } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class AlbumsRepository {
  private readonly store = new JsonFileStore<Album[]>(DATA_FILES.albums, albumsFileSchema, () => []);

  public async findAll(): Promise<Album[]> {
    return this.store.read();
  }

  public async replaceAll(albums: Album[]): Promise<void> {
    await this.store.write(albums);
  }

  public async save(album: Album): Promise<Album> {
    return this.store.update((albums) => {
      const index = albums.findIndex((item) => item.id === album.id);
      const next = [...albums];
      if (index === -1) {
        next.push(album);
      } else {
        next[index] = album;
      }
      return { next, result: album };
    });
  }

  public async insert(album: Omit<Album, 'id'>): Promise<Album> {
    return this.store.update((albums) => {
      const id = albums.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const created: Album = { ...album, id };
      return { next: [...albums, created], result: created };
    });
  }

  public async remove(id: number): Promise<Album | null> {
    return this.store.update((albums) => {
      const existing = albums.find((item) => item.id === id) ?? null;
      return { next: albums.filter((item) => item.id !== id), result: existing };
    });
  }
}

export const albumsRepository = new AlbumsRepository();
