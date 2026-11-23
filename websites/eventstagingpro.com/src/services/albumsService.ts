import type { Album, AlbumImage } from '../domain/models.js';
import { NotFoundError } from '../errors/httpError.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { albumsRepository } from '../repositories/albumsRepository.js';
import type { AlbumFormInput } from '../schemas/adminSchemas.js';
import type { UploadedImage } from './pagesService.js';
import { slugify } from './sanitizeService.js';

export interface AlbumUploads {
  cover: UploadedImage | null;
  images: UploadedImage[];
}

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function byNewest(a: Album, b: Album): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

export class AlbumsService {
  public async list(): Promise<Album[]> {
    return (await albumsRepository.findAll()).sort(byNewest);
  }

  public async listPublished(): Promise<Album[]> {
    return (await this.list()).filter((album) => album.status === 'published');
  }

  public async getById(id: number): Promise<Album> {
    const album = (await albumsRepository.findAll()).find((item) => item.id === id);
    if (!album) {
      throw new NotFoundError('Photo album not found.');
    }
    return album;
  }

  public async findPublishedByKey(key: string): Promise<Album | null> {
    const album = (await albumsRepository.findAll()).find((item) => item.key === key && item.status === 'published');
    return album ?? null;
  }

  public url(album: Pick<Album, 'key'>): string {
    return `/media-gallery/photos/${album.key}`;
  }

  public async create(title: string): Promise<Album> {
    const now = new Date().toISOString();
    const albums = await albumsRepository.findAll();
    return albumsRepository.insert({
      key: this.uniqueKey(title, albums),
      title,
      summary: '',
      cover: '',
      status: 'draft',
      sort: 1000,
      images: [],
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: AlbumFormInput, uploads: AlbumUploads): Promise<Album> {
    const existing = await this.getById(id);
    const keptIds = new Set(input.images.filter((row) => row.id > 0 && !row.remove).map((row) => row.id));
    const removed = existing.images.filter((image) => !keptIds.has(image.id));
    let nextId = existing.images.reduce((max, image) => Math.max(max, image.id), 0) + 1;
    const images: AlbumImage[] = input.images
      .filter((row) => row.id > 0 && !row.remove)
      .map((row) => {
        const previous = existing.images.find((image) => image.id === row.id);
        if (!previous) {
          return null;
        }
        return { ...previous, caption: row.caption, sort: row.sort };
      })
      .filter((image): image is AlbumImage => image !== null)
      .sort((a, b) => a.sort - b.sort || a.id - b.id);

    for (const uploaded of uploads.images) {
      images.push({
        id: nextId,
        sort: 1000 + nextId,
        caption: '',
        src: uploaded.url,
        width: uploaded.width,
        height: uploaded.height
      });
      nextId += 1;
    }

    let cover = existing.cover;
    if (uploads.cover) {
      cover = uploads.cover.url;
    } else if (input.removeCover) {
      cover = '';
    } else if (input.cover.startsWith('/uploads/') || input.cover === '') {
      cover = input.cover;
    }

    const saved = await albumsRepository.save({
      ...existing,
      title: input.title,
      summary: input.summary,
      cover,
      status: input.status,
      sort: input.sort,
      images,
      updatedAt: new Date().toISOString()
    });

    const stillUsed = new Set([saved.cover, ...saved.images.map((image) => image.src)].filter(Boolean));
    for (const image of removed) {
      if (isOwnedUpload(image.src) && !stillUsed.has(image.src)) {
        await mediaRepository.remove(image.src);
      }
    }
    if (existing.cover && existing.cover !== saved.cover && isOwnedUpload(existing.cover) && !stillUsed.has(existing.cover)) {
      await mediaRepository.remove(existing.cover);
    }
    return saved;
  }

  public async remove(id: number): Promise<void> {
    const existing = await albumsRepository.remove(id);
    if (!existing) {
      throw new NotFoundError('Photo album not found.');
    }
    const urls = [existing.cover, ...existing.images.map((image) => image.src)];
    for (const url of urls) {
      if (isOwnedUpload(url)) {
        await mediaRepository.remove(url);
      }
    }
  }

  private uniqueKey(title: string, albums: Album[]): string {
    const base = slugify(title) || 'album';
    let key = base;
    let suffix = 2;
    const taken = new Set(albums.map((album) => album.key));
    while (taken.has(key)) {
      key = `${base}-${suffix}`;
      suffix += 1;
    }
    return key;
  }
}

export const albumsService = new AlbumsService();
