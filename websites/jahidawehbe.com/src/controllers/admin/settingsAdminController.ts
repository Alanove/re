import type { Request, Response } from 'express';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { settingsFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { settingsService } from '../../services/settingsService.js';
import { formErrorState, render, setFlash } from './helpers.js';

function settingsFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return {
    siteName: text('siteName'),
    tagline: text('tagline'),
    description: text('description'),
    logo: text('logo'),
    favicon: text('favicon'),
    footerText: text('footerText'),
    copyright: text('copyright'),
    themeColor: text('themeColor'),
    seo: {
      defaultTitle: text('seoDefaultTitle'),
      defaultDescription: text('seoDefaultDescription'),
      defaultKeywords: text('seoDefaultKeywords'),
      defaultImage: text('seoDefaultImage')
    }
  };
}

export class SettingsAdminController {
  public static async editForm(_req: Request, res: Response): Promise<void> {
    render(res, 'settings/edit', {
      pageTitle: 'Site Settings',
      values: await settingsService.get()
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'settings/edit', {
        pageTitle: 'Site Settings',
        values: settingsFromBody(body),
        error: message,
        errors: fields
      });
    };
    const parsed = safeParseFields(settingsFormSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const logoFile = firstFile(req, 'logoFile');
    const faviconFile = firstFile(req, 'faviconFile');
    const seoImageFile = firstFile(req, 'seoImageFile');
    const saved: { url: string }[] = [];
    try {
      const logo = logoFile ? await mediaService.saveImage(logoFile, 'site', 'logo') : null;
      if (logo) {
        saved.push(logo);
      }
      const favicon = faviconFile ? await mediaService.saveImage(faviconFile, 'site', 'favicon') : null;
      if (favicon) {
        saved.push(favicon);
      }
      const seoImage = seoImageFile ? await mediaService.saveImage(seoImageFile, 'site', 'social') : null;
      if (seoImage) {
        saved.push(seoImage);
      }
      await settingsService.update(parsed.data, {
        logo: logo?.url ?? null,
        favicon: favicon?.url ?? null,
        seoDefaultImage: seoImage?.url ?? null
      });
    } catch (error) {
      await mediaService.discard(saved);
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
      return;
    }
    setFlash(req, 'success', 'Site settings saved.');
    res.redirect('/admin/site-settings');
  }
}
