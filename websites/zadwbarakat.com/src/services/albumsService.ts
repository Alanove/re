import type { Album, AlbumImage } from '../domain/models.js';
import { ConflictError, NotFoundError } from '../errors/httpError.js';
import { slugifyArabic } from '../lib/arabicNormalize.js';
import { albumsRepository } from '../repositories/contentRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { AlbumFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import type { UploadedImage } from './pagesService.js';
import { isOwnedUpload } from './uploadOwnership.js';

function newestFirst(a: Album, b: Album): number {
  return a.sort - b.sort || b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id;
}

export class AlbumsService {
  public async list(): Promise<Album[]> {
    return (await albumsRepository.findAll()).sort(newestFirst);
  }

  public async listPublished(): Promise<Album[]> {
    return (await this.list()).filter((album) => album.status === 'published' && album.images.length > 0);
  }

  public async findPublishedBySlug(slug: string): Promise<Album | null> {
    return (await this.listPublished()).find((album) => album.slug === slug) ?? null;
  }

  public async getById(id: number): Promise<Album> {
    const album = await albumsRepository.findById(id);
    if (!album) {
      throw new NotFoundError('Album not found.');
    }
    return album;
  }

  public async create(input: AlbumFormInput, uploads: UploadedImage[]): Promise<Album> {
    const slug = input.slug || slugifyArabic(input.title);
    await this.assertFreeSlug(slug, null);
    const now = new Date().toISOString();
    const created = await albumsRepository.insert({
      legacyId: null,
      slug,
      title: input.title,
      summary: input.summary,
      images: this.appendUploads([], uploads),
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      publishedAt: input.publishedAt ?? now,
      dateKnown: true,
      createdAt: now,
      updatedAt: now
    });
    contentEvents.changed('album', created.id);
    return created;
  }

  public async update(id: number, input: AlbumFormInput, uploads: UploadedImage[]): Promise<Album> {
    const existing = await this.getById(id);
    const slug = input.slug || existing.slug;
    await this.assertFreeSlug(slug, id);
    const known = new Map(existing.images.map((image) => [image.src, image]));
    const kept: AlbumImage[] = [];
    for (const row of [...input.images].sort((a, b) => a.sort - b.sort)) {
      const image = known.get(row.src);
      if (!image) {
        continue;
      }
      known.delete(row.src);
      if (row.remove) {
        if (isOwnedUpload(image.src)) {
          await mediaRepository.remove(image.src);
        }
        continue;
      }
      kept.push({ ...image, caption: row.caption });
    }
    kept.push(...known.values());
    const saved = await albumsRepository.replace({
      ...existing,
      slug,
      title: input.title,
      summary: input.summary,
      images: this.appendUploads(kept, uploads),
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      publishedAt: input.publishedAt ?? existing.publishedAt,
      dateKnown: input.publishedAt !== null || existing.dateKnown,
      updatedAt: new Date().toISOString()
    });
    contentEvents.changed('album', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await albumsRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Album not found.');
    }
    for (const image of removed.images) {
      if (isOwnedUpload(image.src)) {
        await mediaRepository.remove(image.src);
      }
    }
    contentEvents.changed('album', id);
  }

  private appendUploads(images: AlbumImage[], uploads: UploadedImage[]): AlbumImage[] {
    return [...images, ...uploads.map((upload) => ({ src: upload.url, width: upload.width, height: upload.height, caption: '' }))];
  }

  private async assertFreeSlug(slug: string, selfId: number | null): Promise<void> {
    if ((await albumsRepository.findAll()).some((album) => album.slug === slug && album.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another album uses this slug' });
    }
  }
}

export const albumsService = new AlbumsService();
