import type { ImageRef, Video } from '../domain/models.js';
import { ConflictError, NotFoundError } from '../errors/httpError.js';
import { slugifyArabic } from '../lib/arabicNormalize.js';
import { videosRepository } from '../repositories/contentRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { VideoFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { isOwnedUpload } from './uploadOwnership.js';

function ordered(a: Video, b: Video): number {
  return a.sort - b.sort || b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id;
}

/** Poster for the click-to-play facade: the uploaded image, otherwise YouTube's own thumbnail. */
export function videoPoster(video: Video): string {
  return video.image?.src ?? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
}

export class VideosService {
  public async list(): Promise<Video[]> {
    return (await videosRepository.findAll()).sort(ordered);
  }

  public async listPublished(): Promise<Video[]> {
    return (await this.list()).filter((video) => video.status === 'published');
  }

  public async findPublishedBySlug(slug: string): Promise<Video | null> {
    return (await this.listPublished()).find((video) => video.slug === slug) ?? null;
  }

  public async getById(id: number): Promise<Video> {
    const video = await videosRepository.findById(id);
    if (!video) {
      throw new NotFoundError('Video not found.');
    }
    return video;
  }

  public async create(input: VideoFormInput, image: ImageRef | null): Promise<Video> {
    const slug = input.slug || slugifyArabic(input.title);
    await this.assertFreeSlug(slug, null);
    const now = new Date().toISOString();
    const created = await videosRepository.insert({
      slug,
      title: input.title,
      summary: input.summary,
      youtubeId: input.youtube,
      image: image ?? (input.image ? { src: input.image, width: null, height: null } : null),
      direction: input.direction,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      publishedAt: input.publishedAt ?? now,
      dateKnown: true,
      createdAt: now,
      updatedAt: now
    });
    contentEvents.changed('video', created.id);
    return created;
  }

  public async update(id: number, input: VideoFormInput, image: ImageRef | null): Promise<Video> {
    const existing = await this.getById(id);
    const slug = input.slug || existing.slug;
    await this.assertFreeSlug(slug, id);
    let nextImage: ImageRef | null = input.removeImage ? null : existing.image;
    if (!input.removeImage && input.image && input.image !== existing.image?.src) {
      nextImage = { src: input.image, width: null, height: null };
    }
    if (image) {
      nextImage = image;
    }
    if (existing.image && existing.image.src !== nextImage?.src && isOwnedUpload(existing.image.src)) {
      await mediaRepository.remove(existing.image.src);
    }
    const saved = await videosRepository.replace({
      ...existing,
      slug,
      title: input.title,
      summary: input.summary,
      youtubeId: input.youtube,
      image: nextImage,
      direction: input.direction,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      publishedAt: input.publishedAt ?? existing.publishedAt,
      dateKnown: input.publishedAt !== null || existing.dateKnown,
      updatedAt: new Date().toISOString()
    });
    contentEvents.changed('video', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await videosRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Video not found.');
    }
    if (removed.image && isOwnedUpload(removed.image.src)) {
      await mediaRepository.remove(removed.image.src);
    }
    contentEvents.changed('video', id);
  }

  private async assertFreeSlug(slug: string, selfId: number | null): Promise<void> {
    if ((await videosRepository.findAll()).some((video) => video.slug === slug && video.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another video uses this slug' });
    }
  }
}

export const videosService = new VideosService();
