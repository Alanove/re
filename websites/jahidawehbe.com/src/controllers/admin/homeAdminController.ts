import type { Request, Response } from 'express';
import { HERO_INTERVAL_DEFAULT, HERO_SLIDES_MAX, QUOTES_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { rowIndexes } from '../../schemas/formHelpers.js';
import { HOME_SECTION_LABELS, homeService, type HomeUploads } from '../../services/homeService.js';
import type { ImagePreset } from '../../services/imageProcessingService.js';
import { mediaService } from '../../services/mediaService.js';
import { formErrorState, params, render, setFlash, toRawRowFields } from './helpers.js';

interface SectionImage {
  preset: ImagePreset;
  label: string;
  hint: string;
}

const SECTION_IMAGES: Record<HomeSectionKey, SectionImage | null> = {
  hero: null,
  upcoming: null,
  videos: null,
  about: { preset: 'content', label: 'Photo', hint: 'Shown beside the biography text. Converted to WebP, max 1600px.' },
  quotes: { preset: 'hero', label: 'Background photo', hint: 'Darkened behind the quotes. Converted to WebP, max 2000px.' },
  events: null,
  news: null
};

const ROW_PREFIX: Partial<Record<HomeSectionKey, string>> = { hero: 'slides', quotes: 'items' };

export function slideImageField(index: number): string {
  return `slides[${index}][imageFile]`;
}

export function slideVideoField(index: number): string {
  return `slides[${index}][videoFile]`;
}

/** Every multipart field the home section forms can send, for the upload middleware. */
export function homeUploadFields(): { name: string; maxCount: number }[] {
  return [
    { name: 'imageFile', maxCount: 1 },
    ...Array.from({ length: HERO_SLIDES_MAX }, (_, index) => [
      { name: slideImageField(index), maxCount: 1 },
      { name: slideVideoField(index), maxCount: 1 }
    ]).flat()
  ];
}

function uploadedUrls(uploads: HomeUploads): { url: string }[] {
  return [uploads.image, ...uploads.slides.flatMap((slide) => [slide.image, slide.video])].filter((url): url is string => Boolean(url)).map((url) => ({ url }));
}

async function saveUploads(req: Request, key: HomeSectionKey, body: Record<string, unknown>, uploads: HomeUploads): Promise<void> {
  const sectionImage = SECTION_IMAGES[key];
  if (sectionImage) {
    const file = firstFile(req, 'imageFile');
    uploads.image = file ? (await mediaService.saveImage(file, 'home', sectionImage.preset)).url : null;
    return;
  }
  if (key !== 'hero') {
    return;
  }
  for (const index of rowIndexes(body.slides).kept) {
    const slot: HomeUploads['slides'][number] = { image: null, video: null };
    uploads.slides.push(slot);
    const image = firstFile(req, slideImageField(index));
    if (image) {
      slot.image = (await mediaService.saveImage(image, 'home', 'hero')).url;
    }
    const video = firstFile(req, slideVideoField(index));
    if (video) {
      slot.video = (await mediaService.saveVideo(video, 'home')).url;
    }
  }
}

function formOptions(key: HomeSectionKey): Record<string, unknown> {
  return {
    includeCustomEditor: key === 'about',
    sectionImage: SECTION_IMAGES[key],
    quotesMax: QUOTES_MAX,
    slidesMax: HERO_SLIDES_MAX
  };
}

function rawFields(key: HomeSectionKey, body: Record<string, unknown>, fields: Record<string, string>): Record<string, string> {
  const prefix = ROW_PREFIX[key];
  return prefix ? toRawRowFields(body[prefix], prefix, fields) : fields;
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
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', rawFields(key, body, parsed.fields));
      return;
    }
    const uploads: HomeUploads = { image: null, slides: [] };
    try {
      await saveUploads(req, key, body, uploads);
      await homeService.updateSection(key, parsed.data, uploads);
    } catch (error) {
      await mediaService.discard(uploadedUrls(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      HomeAdminController.renderInvalid(res, key, body, state.message, rawFields(key, body, state.fields));
      return;
    }
    setFlash(req, 'success', `${HOME_SECTION_LABELS[key]} section saved.`);
    res.redirect(`/admin/home/${key}/edit`);
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
        return {
          ...base,
          eyebrow: text('eyebrow'),
          intro: text('intro'),
          textSide: text('textSide') || 'bottom',
          interval: text('interval') || HERO_INTERVAL_DEFAULT,
          slides: list('slides'),
          cta: { label: text('ctaLabel'), url: text('ctaUrl') }
        };
      case 'about':
        return { ...base, heading: text('heading'), content: text('content'), image: text('image'), cta: { label: text('ctaLabel'), url: text('ctaUrl') } };
      case 'quotes':
        return { ...base, image: text('image'), items: list('items') };
      case 'upcoming':
      case 'videos':
      case 'events':
      case 'news':
        return { ...base, intro: text('intro'), count: text('count') };
    }
  }
}
