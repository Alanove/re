import type { Request, Response } from 'express';
import { HERO_SLOGANS_MAX, LATEST_POSTS_MAX, SERVICES_MAX, TEAM_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { BadRequestError } from '../../errors/httpError.js';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { rowIndexes } from '../../schemas/formHelpers.js';
import { HOME_SECTION_LABELS, homeService, type HomeUploads } from '../../services/homeService.js';
import type { ImagePreset } from '../../services/imageProcessingService.js';
import { mediaService } from '../../services/mediaService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

const SECTION_IMAGE: Partial<Record<HomeSectionKey, { preset: ImagePreset; label: string; hint: string }>> = {
  hero: { preset: 'hero', label: 'Background image', hint: 'Full-screen background behind the slogans. Converted to WebP, max 2000px.' },
  studios: { preset: 'hero', label: 'Background image', hint: 'Shown behind the studios section. Converted to WebP, max 2000px.' },
  contact: { preset: 'hero', label: 'Background image', hint: 'Shown behind the contact section. Converted to WebP, max 2000px.' }
};

export function memberPhotoField(index: number): string {
  return `members[${index}][photoFile]`;
}

function uploadedUrls(uploads: HomeUploads): { url: string }[] {
  return [uploads.image, ...uploads.memberPhotos].filter((url): url is string => Boolean(url)).map((url) => ({ url }));
}

async function saveUploads(req: Request, key: HomeSectionKey, body: Record<string, unknown>): Promise<HomeUploads> {
  const uploads: HomeUploads = { image: null, memberPhotos: [] };
  const sectionImage = SECTION_IMAGE[key];
  if (sectionImage) {
    const file = firstFile(req, 'imageFile');
    uploads.image = file ? (await mediaService.saveImage(file, 'home', sectionImage.preset)).url : null;
    return uploads;
  }
  if (key !== 'team') {
    return uploads;
  }
  const { kept, blank } = rowIndexes(body.members);
  const orphan = blank.find((index) => firstFile(req, memberPhotoField(index)));
  if (orphan !== undefined) {
    throw new BadRequestError('Please correct the highlighted fields.', { [`members.${orphan}.name`]: 'Add a name before uploading a photo for this member' });
  }
  try {
    for (const index of kept) {
      const file = firstFile(req, memberPhotoField(index));
      uploads.memberPhotos.push(file ? (await mediaService.saveImage(file, 'home', 'card')).url : null);
    }
    return uploads;
  } catch (error) {
    await mediaService.discard(uploadedUrls(uploads));
    throw error;
  }
}

const SECTIONS_WITH_RICH_TEXT = new Set<HomeSectionKey>(['about', 'studios', 'team']);

function formOptions(key: HomeSectionKey): Record<string, unknown> {
  return {
    includeCustomEditor: SECTIONS_WITH_RICH_TEXT.has(key),
    sectionImage: SECTION_IMAGE[key] ?? null,
    slogansMax: HERO_SLOGANS_MAX,
    servicesMax: SERVICES_MAX,
    teamMax: TEAM_MAX,
    latestPostsMax: LATEST_POSTS_MAX
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
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      const fields = key === 'team' ? HomeAdminController.toRawRowFields(body.members, 'members', parsed.fields) : key === 'services' ? HomeAdminController.toRawRowFields(body.items, 'items', parsed.fields) : parsed.fields;
      HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', fields);
      return;
    }
    let uploads: HomeUploads = { image: null, memberPhotos: [] };
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
        return {
          enabled: Boolean(body.enabled),
          eyebrow: text('eyebrow'),
          slogans: text('slogans').split(/\r?\n/),
          image: text('image'),
          primaryCta: { label: text('primaryLabel'), url: text('primaryUrl') },
          secondaryCta: { label: text('secondaryLabel'), url: text('secondaryUrl') }
        };
      case 'about':
        return { ...base, content: text('content'), highlight: text('highlight'), statValue: text('statValue'), statLabel: text('statLabel') };
      case 'studios':
        return { ...base, content: text('content'), quote: text('quote'), image: text('image') };
      case 'services':
        return { ...base, intro: text('intro'), items: list('items') };
      case 'team':
        return { ...base, content: text('content'), members: list('members') };
      case 'latestPosts':
        return { ...base, intro: text('intro'), limit: Number.parseInt(text('limit'), 10) || 3 };
      case 'contact':
        return { ...base, intro: text('intro'), image: text('image') };
    }
  }
}
