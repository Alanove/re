import type { Request, Response } from 'express';
import { pageKindSchema, type PageImage } from '../../domain/models.js';
import { filesFor, firstFile } from '../../middleware/upload.js';
import { mediaService } from '../../services/mediaService.js';
import type { PageNode, PageUploads } from '../../services/pagesService.js';
import { render } from './helpers.js';

const KIND_LABELS: Record<string, string> = {
  page: 'Content page',
  section: 'Section hub (lists child pages and article sections as cards)',
  contact: 'Contact page (shows the contact form)',
  library: 'Spiritual library (book catalogue with search and filters)',
  hymns: 'Hymns (audio player with search and categories)',
  purchases: 'Purchases (items for sale with an order form)',
  albums: 'Photo albums (lists the albums; each album opens at /<page>/<album>)',
  videos: 'Videos (lists the videos; each video opens at /<page>/<video>)'
};

export const PAGE_KIND_OPTIONS = pageKindSchema.options.map((kind) => ({ value: kind, label: KIND_LABELS[kind] ?? kind }));

export const DIRECTION_OPTIONS = [
  { value: 'auto', label: 'Automatic (detect from the text)' },
  { value: 'rtl', label: 'Right to left (Arabic)' },
  { value: 'ltr', label: 'Left to right (French / English)' }
];

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
    direction: 'auto',
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
    direction: text('direction') || 'auto',
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
  isCreate: boolean;
  page: Record<string, unknown> | PageNode;
  gallery: PageImage[];
  parents: { id: number; label: string }[];
  error?: string;
  errors?: Record<string, string>;
}

export function renderPageForm(res: Response, locals: PageFormLocals): void {
  render(res, 'pages/edit', {
    ...locals,
    kinds: PAGE_KIND_OPTIONS,
    directions: DIRECTION_OPTIONS,
    errors: locals.errors ?? {},
    error: locals.error ?? null,
    includeCustomEditor: true
  });
}
