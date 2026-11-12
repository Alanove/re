import type { Request, Response } from 'express';
import { HERO_SLIDES_MAX, HOME_LIST_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { BadRequestError } from '../../errors/httpError.js';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { rowIndexes } from '../../schemas/formHelpers.js';
import { HOME_SECTION_LABELS, homeService, isHomeListSection, type HomeUploads } from '../../services/homeService.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

function slideFileField(index: number): string {
  return `slides[${index}][imageFile]`;
}

/** Every multipart field the home section forms can send, for the upload middleware. */
export function homeUploadFields(): { name: string; maxCount: number }[] {
  const names = ['imageFile'];
  for (let index = 0; index < HERO_SLIDES_MAX; index += 1) {
    names.push(slideFileField(index));
  }
  return names.map((name) => ({ name, maxCount: 1 }));
}

function uploadedUrls(uploads: HomeUploads): { url: string }[] {
  return [uploads.image, ...uploads.rowImages].filter((url): url is string => Boolean(url)).map((url) => ({ url }));
}

async function saveUploads(req: Request, key: HomeSectionKey, body: Record<string, unknown>, uploads: HomeUploads): Promise<void> {
  if (key === 'donate') {
    const imageFile = firstFile(req, 'imageFile');
    if (imageFile) {
      uploads.image = (await mediaService.saveImage(imageFile, 'home', 'hero')).url;
    }
    return;
  }
  if (key !== 'hero') {
    return;
  }
  const { kept, blank } = rowIndexes(body.slides);
  const orphan = blank.find((index) => firstFile(req, slideFileField(index)));
  if (orphan !== undefined) {
    throw new BadRequestError('Please correct the highlighted fields.', { [`slides.${orphan}.title`]: 'Fill in this slide title before uploading a photo for it' });
  }
  for (const index of kept) {
    const file = firstFile(req, slideFileField(index));
    uploads.rowImages.push(file ? (await mediaService.saveImage(file, 'home', 'slide')).url : null);
  }
}

async function formOptions(key: HomeSectionKey): Promise<Record<string, unknown>> {
  const sourcePages = isHomeListSection(key)
    ? (await pagesService.getPagesList()).filter((page) => page.kind === 'page' || page.kind === 'section').map((page) => ({ key: page.key, title: page.title }))
    : [];
  return { slidesMax: HERO_SLIDES_MAX, listMax: HOME_LIST_MAX, isListSection: isHomeListSection(key), sourcePages };
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
      ...(await formOptions(key))
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      const fields = key === 'hero' ? HomeAdminController.toRawRowFields(body.slides, 'slides', parsed.fields) : parsed.fields;
      await HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', fields);
      return;
    }
    const uploads: HomeUploads = { image: null, rowImages: [] };
    try {
      await saveUploads(req, key, body, uploads);
      await homeService.updateSection(key, parsed.data, uploads);
    } catch (error) {
      await mediaService.discard(uploadedUrls(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await HomeAdminController.renderInvalid(res, key, body, state.message, state.fields);
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

  private static async renderInvalid(res: Response, key: HomeSectionKey, body: Record<string, unknown>, message: string, fields: Record<string, string>): Promise<void> {
    res.status(422);
    render(res, 'home/edit', {
      pageTitle: `Home: ${HOME_SECTION_LABELS[key]}`,
      sectionKey: key,
      sectionLabel: HOME_SECTION_LABELS[key],
      section: HomeAdminController.sectionFromBody(body),
      ...(await formOptions(key)),
      error: message,
      errors: fields
    });
  }

  private static sectionFromBody(body: Record<string, unknown>): Record<string, unknown> {
    const text = (name: string): string => (typeof body[name] === 'string' ? body[name] : '');
    const value = body.slides;
    const slides = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value as Record<string, unknown>) : [];
    return {
      enabled: Boolean(body.enabled),
      title: text('title'),
      intro: text('intro'),
      text: text('text'),
      label: text('label'),
      image: text('image'),
      sourceKey: text('sourceKey'),
      count: text('count'),
      interval: text('interval'),
      slides
    };
  }
}
