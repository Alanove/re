import type { Request, Response } from 'express';
import { mailService } from '../../services/mailService.js';
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
    contactEmail: text('contactEmail'),
    contactPhone: text('contactPhone'),
    whatsappNumber: text('whatsappNumber'),
    brochureUrl: text('brochureUrl'),
    footerText: text('footerText'),
    copyright: text('copyright'),
    inquiryTopics: text('inquiryTopics').split(/\r?\n/),
    themeColor: text('themeColor'),
    social: {
      facebook: text('socialFacebook'),
      instagram: text('socialInstagram'),
      linkedin: text('socialLinkedin'),
      youtube: text('socialYoutube')
    },
    ctaBand: { title: text('ctaTitle'), text: text('ctaText'), label: text('ctaLabel') },
    thankYouMessage: text('thankYouMessage'),
    donation: {
      bankDetails: text('donationBankDetails').split(/\r?\n/),
      presetAmounts: text('donationPresetAmounts').split(/\r?\n/),
      causes: text('donationCauses').split(/\r?\n/),
      thankYouMessage: text('donationThankYou')
    },
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
      values: await settingsService.get(),
      mailConfigured: mailService.isConfigured()
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'settings/edit', {
        pageTitle: 'Site Settings',
        values: settingsFromBody(body),
        mailConfigured: mailService.isConfigured(),
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
    const brochureFile = firstFile(req, 'brochureFile');
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
      const brochure = brochureFile ? await mediaService.saveDocument(brochureFile, 'site') : null;
      if (brochure) {
        saved.push(brochure);
      }
      const seoImage = seoImageFile ? await mediaService.saveImage(seoImageFile, 'site', 'social') : null;
      if (seoImage) {
        saved.push(seoImage);
      }
      await settingsService.update(parsed.data, {
        logo: logo?.url ?? null,
        favicon: favicon?.url ?? null,
        brochureUrl: brochure?.url ?? null,
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
