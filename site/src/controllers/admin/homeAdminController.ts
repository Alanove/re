import type { Request, Response } from 'express';
import { HERO_SLIDES_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { BadRequestError } from '../../errors/httpError.js';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { rowIndexes } from '../../schemas/formHelpers.js';
import { HOME_SECTION_LABELS, homeService, type HomeUploads } from '../../services/homeService.js';
import { mediaService } from '../../services/mediaService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

const SECTIONS_WITH_IMAGE = new Set<HomeSectionKey>(['about', 'solar', 'presence']);

function uploadedUrls(uploads: HomeUploads): { url: string }[] {
  const urls = [uploads.image, ...uploads.slides.flatMap((slide) => [slide.image, slide.video])];
  return urls.filter((url): url is string => Boolean(url)).map((url) => ({ url }));
}

async function saveUploads(req: Request, key: HomeSectionKey, body: Record<string, unknown>): Promise<HomeUploads> {
  const uploads: HomeUploads = { image: null, slides: [] };
  if (SECTIONS_WITH_IMAGE.has(key)) {
    const file = firstFile(req, 'imageFile');
    uploads.image = file ? (await mediaService.saveImage(file, 'home')).url : null;
    return uploads;
  }
  if (key !== 'hero') {
    return uploads;
  }
  const { kept, blank } = rowIndexes(body.slides);
  const orphan = blank.find((index) => firstFile(req, `slideImageFile${index}`) || firstFile(req, `slideVideoFile${index}`));
  if (orphan !== undefined) {
    throw new BadRequestError('Please correct the highlighted fields.', { [`slides.${orphan}.title`]: 'Add a title before uploading media for this slide' });
  }
  try {
    for (const index of kept) {
      const imageFile = firstFile(req, `slideImageFile${index}`);
      const videoFile = firstFile(req, `slideVideoFile${index}`);
      const slide = { image: null as string | null, video: null as string | null };
      uploads.slides.push(slide);
      slide.image = imageFile ? (await mediaService.saveImage(imageFile, 'home')).url : null;
      slide.video = videoFile ? (await mediaService.saveVideo(videoFile, 'home')).url : null;
    }
    return uploads;
  } catch (error) {
    await mediaService.discard(uploadedUrls(uploads));
    throw error;
  }
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
      hasImage: SECTIONS_WITH_IMAGE.has(key),
      heroSlidesMax: HERO_SLIDES_MAX
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      const fields = key === 'hero' ? HomeAdminController.toRawSlideFields(body, parsed.fields) : parsed.fields;
      HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', fields);
      return;
    }
    let uploads: HomeUploads = { image: null, slides: [] };
    try {
      uploads = await saveUploads(req, key, body);
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

  private static toRawSlideFields(body: Record<string, unknown>, fields: Record<string, string>): Record<string, string> {
    const { kept } = rowIndexes(body.slides);
    return Object.fromEntries(
      Object.entries(fields).map(([name, message]) => {
        const match = /^slides\.(\d+)\.(.+)$/.exec(name);
        const raw = match ? kept[Number(match[1])] : undefined;
        return [match && raw !== undefined ? `slides.${raw}.${match[2]}` : name, message];
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
      hasImage: SECTIONS_WITH_IMAGE.has(key),
      heroSlidesMax: HERO_SLIDES_MAX,
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
    const base = { enabled: Boolean(body.enabled), title: text('title'), image: text('image') };
    switch (key) {
      case 'hero':
        return {
          enabled: Boolean(body.enabled),
          slides: list('slides').map((slide) => {
            const field = (name: string): string => (typeof slide[name] === 'string' ? slide[name] : '');
            return {
              title: field('title'),
              text: field('text'),
              image: field('image'),
              video: field('video'),
              zoom: field('zoom'),
              primaryCta: { label: field('primaryLabel'), url: field('primaryUrl') },
              secondaryCta: { label: field('secondaryLabel'), url: field('secondaryUrl') }
            };
          })
        };
      case 'about':
        return {
          ...base,
          lead: text('lead'),
          text: text('text'),
          statValue: text('statValue'),
          statLabel: text('statLabel'),
          cta: { label: text('ctaLabel'), url: text('ctaUrl') }
        };
      case 'values':
        return { ...base, intro: text('intro'), items: list('items').map((item) => ({ ...item, highlight: Boolean(item.highlight) })) };
      case 'solar':
        return {
          ...base,
          text: text('text'),
          cards: list('cards'),
          listTitle: text('listTitle'),
          list: text('list').split(/\r?\n/).filter(Boolean),
          cta: { label: text('ctaLabel'), url: text('ctaUrl') }
        };
      case 'activities':
        return { ...base, intro: text('intro'), items: list('items') };
      case 'presence':
        return { ...base, intro: text('intro') };
      case 'contact':
        return { ...base, intro: text('intro') };
    }
  }
}
