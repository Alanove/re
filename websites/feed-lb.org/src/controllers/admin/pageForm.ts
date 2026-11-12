import type { Request, Response } from 'express';
import { pageKindSchema, type PageImage } from '../../domain/models.js';
import { filesFor, firstFile } from '../../middleware/upload.js';
import { mediaService } from '../../services/mediaService.js';
import type { PageNode, PageUploads } from '../../services/pagesService.js';
import { render } from './helpers.js';

/** `page` is a normal page, `root` the News listing page, `entry` one news story. */
export type PageFormMode = 'page' | 'root' | 'entry';

export interface CollectionMeta {
  label: string;
  singular: string;
  basePath: string;
}

export const NEWS_COLLECTION: CollectionMeta = { label: 'News', singular: 'story', basePath: '/admin/news' };

const KIND_LABELS: Record<string, string> = {
  page: 'Content page',
  section: 'Section landing (lists child pages as cards)',
  contact: 'Contact page',
  news: 'News listing (lists the news stories)',
  donations: 'Donations page (shows the pledge form)',
  partners: 'Partners wall (shows the partner logos)',
  footer: 'Footer data (not routed)'
};

export const PAGE_KIND_OPTIONS = pageKindSchema.options.map((kind) => ({ value: kind, label: KIND_LABELS[kind] ?? kind }));

export function blankPage(parentId: number | null): Record<string, unknown> {
  return {
    id: null,
    title: '',
    header: '',
    slug: '',
    parentId,
    summary: '',
    content: '',
    status: 'draft',
    kind: 'page',
    sort: 100,
    icon: '',
    heroImage: '',
    heroVideo: '',
    seo: { title: '', description: '', keywords: '' },
    url: ''
  };
}

export function valuesFromBody(body: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return {
    ...base,
    title: text('title'),
    header: text('header'),
    slug: text('slug'),
    parentId: text('parentId') ? Number.parseInt(text('parentId'), 10) : null,
    summary: text('summary'),
    content: text('content'),
    status: body.published ? 'published' : 'draft',
    kind: text('kind') || 'page',
    sort: text('sort'),
    icon: text('icon'),
    heroImage: text('heroImage'),
    heroVideo: text('heroVideo'),
    seo: { title: text('seoTitle'), description: text('seoDescription'), keywords: text('seoKeywords') }
  };
}

export function uploadedFiles(uploads: PageUploads): { url: string }[] {
  return [...(uploads.hero ? [uploads.hero] : []), ...(uploads.heroVideo ? [uploads.heroVideo] : []), ...uploads.gallery];
}

export async function saveUploads(req: Request, folder: string): Promise<PageUploads> {
  const uploads: PageUploads = { hero: null, heroVideo: null, gallery: [] };
  try {
    const heroFile = firstFile(req, 'heroImageFile');
    uploads.hero = heroFile ? await mediaService.saveImage(heroFile, folder, 'hero') : null;
    const videoFile = firstFile(req, 'heroVideoFile');
    uploads.heroVideo = videoFile ? await mediaService.saveVideo(videoFile, folder) : null;
    for (const file of filesFor(req, 'galleryFiles')) {
      uploads.gallery.push(await mediaService.saveImage(file, folder, 'gallery'));
    }
    return uploads;
  } catch (error) {
    await mediaService.discard(uploadedFiles(uploads));
    throw error;
  }
}

export interface PageFormLocals {
  pageTitle: string;
  mode?: PageFormMode;
  root?: PageNode | null;
  isCreate: boolean;
  page: Record<string, unknown> | PageNode;
  gallery: PageImage[];
  parents: { id: number; label: string }[];
  error?: string;
  errors?: Record<string, string>;
}

export function renderPageForm(res: Response, locals: PageFormLocals): void {
  const mode = locals.mode ?? 'page';
  render(res, 'pages/edit', {
    ...locals,
    mode,
    root: locals.root ?? null,
    collection: mode === 'page' ? null : NEWS_COLLECTION,
    kinds: PAGE_KIND_OPTIONS,
    errors: locals.errors ?? {},
    error: locals.error ?? null,
    includeCustomEditor: true
  });
}
