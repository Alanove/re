import type { Request, Response } from 'express';
import { HERO_TILES_MAX, SERVICES_MAX, TESTIMONIALS_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { BadRequestError } from '../../errors/httpError.js';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { rowIndexes } from '../../schemas/formHelpers.js';
import { HOME_SECTION_LABELS, homeService, type HomeUploads } from '../../services/homeService.js';
import type { ImagePreset } from '../../services/imageProcessingService.js';
import { mediaService } from '../../services/mediaService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

interface RowMedia {
  list: 'tiles' | 'items';
  field: 'imageFile' | 'photoFile';
  preset: ImagePreset;
  max: number;
  /** Row field that must be filled before a file can be attached to the row. */
  required: 'title' | 'name';
  label: string;
}

interface SectionMedia {
  image: { preset: ImagePreset; label: string; hint: string } | null;
  video: { label: string; hint: string } | null;
  rows: RowMedia | null;
}

const SECTION_MEDIA: Record<HomeSectionKey, SectionMedia> = {
  hero: {
    image: { preset: 'hero', label: 'Background image', hint: 'Full-width photo behind the heading and station tiles. Converted to WebP, max 2000px.' },
    video: null,
    rows: { list: 'tiles', field: 'imageFile', preset: 'card', max: HERO_TILES_MAX, required: 'title', label: 'station tile' }
  },
  about: {
    image: { preset: 'content', label: 'Photo', hint: 'Shown next to the text. Converted to WebP, max 1600px.' },
    video: null,
    rows: null
  },
  prices: { image: null, video: null, rows: null },
  testimonials: {
    image: { preset: 'hero', label: 'Background image', hint: 'Shown behind the quotes, and instead of the video when visitors prefer reduced motion. Converted to WebP.' },
    video: { label: 'Background video', hint: 'Short, silent MP4 or WebM loop up to 25 MB. It plays muted behind the quotes.' },
    rows: { list: 'items', field: 'photoFile', preset: 'card', max: TESTIMONIALS_MAX, required: 'name', label: 'testimonial' }
  },
  services: {
    image: null,
    video: null,
    rows: { list: 'items', field: 'imageFile', preset: 'card', max: SERVICES_MAX, required: 'title', label: 'service' }
  }
};

function rowFileField(media: RowMedia, index: number): string {
  return `${media.list}[${index}][${media.field}]`;
}

/** Every multipart field the home section forms can send, for the upload middleware. */
export function homeUploadFields(): { name: string; maxCount: number }[] {
  const names = new Set<string>(['imageFile', 'videoFile']);
  for (const media of Object.values(SECTION_MEDIA)) {
    if (media.rows) {
      for (let index = 0; index < media.rows.max; index += 1) {
        names.add(rowFileField(media.rows, index));
      }
    }
  }
  return [...names].map((name) => ({ name, maxCount: 1 }));
}

function uploadedUrls(uploads: HomeUploads): { url: string }[] {
  return [uploads.image, uploads.video, ...uploads.rowImages].filter((url): url is string => Boolean(url)).map((url) => ({ url }));
}

async function saveUploads(req: Request, key: HomeSectionKey, body: Record<string, unknown>, uploads: HomeUploads): Promise<void> {
  const media = SECTION_MEDIA[key];
  if (media.rows) {
    const rowsMedia = media.rows;
    const { blank } = rowIndexes(body[rowsMedia.list]);
    const orphan = blank.find((index) => firstFile(req, rowFileField(rowsMedia, index)));
    if (orphan !== undefined) {
      throw new BadRequestError('Please correct the highlighted fields.', {
        [`${rowsMedia.list}.${orphan}.${rowsMedia.required}`]: `Fill in this ${rowsMedia.label} before uploading an image for it`
      });
    }
  }
  const imageFile = media.image ? firstFile(req, 'imageFile') : null;
  if (media.image && imageFile) {
    uploads.image = (await mediaService.saveImage(imageFile, 'home', media.image.preset)).url;
  }
  const videoFile = media.video ? firstFile(req, 'videoFile') : null;
  if (videoFile) {
    uploads.video = (await mediaService.saveVideo(videoFile, 'home')).url;
  }
  if (media.rows) {
    for (const index of rowIndexes(body[media.rows.list]).kept) {
      const file = firstFile(req, rowFileField(media.rows, index));
      uploads.rowImages.push(file ? (await mediaService.saveImage(file, 'home', media.rows.preset)).url : null);
    }
  }
}

function formOptions(key: HomeSectionKey): Record<string, unknown> {
  const media = SECTION_MEDIA[key];
  return {
    includeCustomEditor: key === 'about',
    sectionImage: media.image,
    sectionVideo: media.video,
    tilesMax: HERO_TILES_MAX,
    servicesMax: SERVICES_MAX,
    testimonialsMax: TESTIMONIALS_MAX
  };
}

export class HomeAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const home = await homeService.get();
    render(res, 'home/list', {
      pageTitle: 'Home Page',
      sections: homeSectionKeys.map((key) => ({ key, label: HOME_SECTION_LABELS[key], enabled: home[key].enabled, title: homeService.sectionTitle(home, key) }))
    });
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const home = await homeService.get();
    render(res, 'home/edit', {
      pageTitle: `Home: ${HOME_SECTION_LABELS[key]}`,
      sectionKey: key,
      sectionLabel: HOME_SECTION_LABELS[key],
      section: home[key],
      ...formOptions(key)
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rowsMedia = SECTION_MEDIA[key].rows;
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      const fields = rowsMedia ? HomeAdminController.toRawRowFields(body[rowsMedia.list], rowsMedia.list, parsed.fields) : parsed.fields;
      HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', fields);
      return;
    }
    const uploads: HomeUploads = { image: null, video: null, rowImages: [] };
    try {
      await saveUploads(req, key, body, uploads);
      await homeService.updateSection(key, parsed.data, uploads);
    } catch (error) {
      await mediaService.discard(uploadedUrls(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      HomeAdminController.renderInvalid(res, key, body, state.message, state.fields);
      return;
    }
    setFlash(req, 'success', `${HOME_SECTION_LABELS[key]} section saved.`);
    res.redirect(`/admin/home/${key}/edit`);
  }

  private static toRawRowFields(value: unknown, prefix: string, fields: Record<string, string>): Record<string, string> {
    const { kept } = rowIndexes(value);
    const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.(.+)$`);
    return Object.fromEntries(
      Object.entries(fields).map(([name, message]) => {
        const match = pattern.exec(name);
        const raw = match ? kept[Number(match[1])] : undefined;
        return [match && raw !== undefined ? `${prefix}.${raw}.${match[2]}` : name, message];
      })
    );
  }

  private static renderInvalid(res: Response, key: HomeSectionKey, body: Record<string, unknown>, message: string, fields: Record<string, string>): void {
    res.status(422);
    render(res, 'home/edit', {
      pageTitle: `Home: ${HOME_SECTION_LABELS[key]}`,
      sectionKey: key,
      sectionLabel: HOME_SECTION_LABELS[key],
      section: HomeAdminController.sectionFromBody(key, body),
      ...formOptions(key),
      error: message,
      errors: fields
    });
  }

  private static sectionFromBody(key: HomeSectionKey, body: Record<string, unknown>): Record<string, unknown> {
    const text = (name: string): string => (typeof body[name] === 'string' ? body[name] : '');
    const list = (name: string): Record<string, unknown>[] => {
      const value = body[name];
      if (Array.isArray(value)) {
        return value as Record<string, unknown>[];
      }
      if (value && typeof value === 'object') {
        return Object.values(value as Record<string, Record<string, unknown>>);
      }
      return [];
    };
    const base = { enabled: Boolean(body.enabled), title: text('title') };
    switch (key) {
      case 'hero':
        return { ...base, eyebrow: text('eyebrow'), intro: text('intro'), image: text('image'), tiles: list('tiles') };
      case 'about':
        return { ...base, heading: text('heading'), content: text('content'), image: text('image'), cta: { label: text('ctaLabel'), url: text('ctaUrl') } };
      case 'prices':
        return { ...base, intro: text('intro') };
      case 'testimonials':
        return { ...base, image: text('image'), video: text('video'), items: list('items') };
      case 'services':
        return { ...base, intro: text('intro'), items: list('items') };
    }
  }
}
