import type { Video, VideoProvider } from '../domain/models.js';
import { facebookPluginUrl, facebookWatchUrl, youtubeEmbedUrl, youtubeIdFromUrl, youtubeWatchUrl } from '../domain/watchLinks.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { videosRepository } from '../repositories/videosRepository.js';
import type { VideoFormInput } from '../schemas/adminSchemas.js';
import type { UploadedImage } from './pagesService.js';
import { slugify } from './sanitizeService.js';

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function byNewest(a: Video, b: Video): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

export function linksFor(provider: VideoProvider, raw: string): { watchUrl: string; embedUrl: string } {
  if (provider === 'youtube') {
    const id = youtubeIdFromUrl(raw);
    if (!id) {
      throw new BadRequestError('Please correct the highlighted fields.', { watchUrl: 'Paste a YouTube link' });
    }
    return { watchUrl: youtubeWatchUrl(id), embedUrl: youtubeEmbedUrl(id) };
  }
  const watchUrl = facebookWatchUrl(raw);
  if (!watchUrl) {
    throw new BadRequestError('Please correct the highlighted fields.', { watchUrl: 'Paste a Facebook video link' });
  }
  return { watchUrl, embedUrl: facebookPluginUrl(watchUrl) };
}

export class VideosService {
  public async list(): Promise<Video[]> {
    return (await videosRepository.findAll()).sort(byNewest);
  }

  public async listPublished(): Promise<Video[]> {
    return (await this.list()).filter((video) => video.status === 'published');
  }

  public async getById(id: number): Promise<Video> {
    const video = (await videosRepository.findAll()).find((item) => item.id === id);
    if (!video) {
      throw new NotFoundError('Video not found.');
    }
    return video;
  }

  public async findPublishedByKey(key: string): Promise<Video | null> {
    return (await videosRepository.findAll()).find((item) => item.key === key && item.status === 'published') ?? null;
  }

  public url(video: Pick<Video, 'key'>): string {
    return `/media-gallery/videos/${video.key}`;
  }

  public async create(title: string): Promise<Video> {
    const now = new Date().toISOString();
    const videos = await videosRepository.findAll();
    return videosRepository.insert({
      key: this.uniqueKey(title, videos),
      title,
      summary: '',
      thumb: '',
      provider: 'youtube',
      watchUrl: '',
      embedUrl: '',
      status: 'draft',
      sort: 1000,
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: VideoFormInput, thumb: UploadedImage | null): Promise<Video> {
    const existing = await this.getById(id);
    const links = linksFor(input.provider, input.watchUrl);
    let nextThumb = input.removeThumb ? '' : input.thumb || existing.thumb;
    if (thumb) {
      nextThumb = thumb.url;
    }
    const saved = await videosRepository.save({
      ...existing,
      title: input.title,
      summary: input.summary,
      thumb: nextThumb,
      provider: input.provider,
      watchUrl: links.watchUrl,
      embedUrl: links.embedUrl,
      status: input.status,
      sort: input.sort,
      updatedAt: new Date().toISOString()
    });
    if (existing.thumb && existing.thumb !== saved.thumb && isOwnedUpload(existing.thumb)) {
      await mediaRepository.remove(existing.thumb);
    }
    return saved;
  }

  public async remove(id: number): Promise<void> {
    const existing = await videosRepository.remove(id);
    if (!existing) {
      throw new NotFoundError('Video not found.');
    }
    if (isOwnedUpload(existing.thumb)) {
      await mediaRepository.remove(existing.thumb);
    }
  }

  private uniqueKey(title: string, videos: Video[]): string {
    const base = slugify(title) || 'video';
    let key = base;
    let suffix = 2;
    const taken = new Set(videos.map((video) => video.key));
    while (taken.has(key)) {
      key = `${base}-${suffix}`;
      suffix += 1;
    }
    return key;
  }
}

export const videosService = new VideosService();
