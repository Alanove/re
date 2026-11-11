import { Request, Response } from 'express';
import pagesService from '../../src/services/pagesService';
import { securityService } from '../../src/services/securityService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { getSuggestedContactLocationsFromLegacyHtml } from '../../src/services/contactLocationsHtmlParser';
import type { ContactLocation } from '../../src/types/contactLocation';

const siteSettingsService = SiteSettingsService.getInstance();

function normalizeLocationsRaw(raw: unknown): any[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      return normalizeLocationsRaw(JSON.parse(t));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item) => item != null && typeof item === 'object');
  }
  if (typeof raw === 'object') {
    return Object.keys(raw as Record<string, unknown>)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (raw as Record<string, unknown>)[k])
      .filter((item): item is object => item != null && typeof item === 'object');
  }
  return [];
}

function locationsFromBody(raw: unknown): ContactLocation[] {
  const arr = normalizeLocationsRaw(raw);
  const splitLines = (s: unknown) =>
    String(s ?? '')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  return arr
    .map((item: any) => {
      const loc: ContactLocation = {
        label: String(item?.label ?? '').trim(),
        addressLines: splitLines(item?.addressLines),
        phones: splitLines(item?.phones),
        emails: splitLines(item?.emails)
      };
      const mapUrl = String(item?.mapUrl ?? '').trim();
      if (mapUrl) loc.mapUrl = mapUrl;
      return loc;
    })
    .filter(
      (loc) =>
        loc.label || loc.addressLines.length || loc.phones.length || loc.emails.length || !!loc.mapUrl
    );
}

export class ContactSettingsController {
  private static async renderForm(
    req: Request,
    res: Response,
    opts: { locations?: ContactLocation[]; success?: string; error?: string }
  ): Promise<void> {
    const settings = await siteSettingsService.getAllSettings();
    let locations = opts.locations;
    if (!locations) {
      const saved = settings.contactLocations || [];
      locations = saved.length ? saved : getSuggestedContactLocationsFromLegacyHtml();
    }

    res.render('contact-settings/contact-settings', {
      title: 'Contact Settings',
      pageTitle: 'Contact Settings',
      pageSubtitle:
        'Primary contact details, WhatsApp, primary address, and all locations shown on the storefront Contact Us page.',
      user: (req as any).user,
      url: req.originalUrl,
      csrfToken: (res.locals as any).csrfToken || '',
      settings,
      locations,
      success: opts.success,
      error: opts.error
    });
  }

  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const opts: { locations?: ContactLocation[]; success?: string; error?: string } = {};
      if (typeof req.query.success === 'string') opts.success = req.query.success;
      if (typeof req.query.error === 'string') opts.error = req.query.error;
      await ContactSettingsController.renderForm(req, res, opts);
    } catch (e) {
      console.error('ContactSettingsController.index:', e);
      res.status(500).send('Internal Server Error');
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    securityService.csrfProtection(req, res, async (csrfErr: any) => {
      if (csrfErr) {
        return res.redirect(
          '/admin/contact-settings?error=' + encodeURIComponent('Security validation failed. Please try again.')
        );
      }
      try {
        const locations = locationsFromBody(req.body.locations);
        const idxRaw = req.body.footer_main_location_index;
        let footerMainLocationIndex: number | null = null;
        if (idxRaw !== undefined && idxRaw !== null && String(idxRaw).trim() !== '') {
          const n = parseInt(String(idxRaw), 10);
          if (!Number.isNaN(n) && n >= 0 && n < locations.length) footerMainLocationIndex = n;
        }
        const ok = await siteSettingsService.updateSettings({
          contactEmail: req.body.contactEmail || '',
          contactPhone: req.body.contactPhone || '',
          contactWhatsapp: req.body.contactWhatsapp || '',
          address: req.body.address || '',
          contactLocations: locations,
          footerMainLocationIndex
        });
        await pagesService.reloadCache();
        siteSettingsService.reloadSettings();
        if (ok) {
          res.redirect('/admin/contact-settings?success=' + encodeURIComponent('Contact settings saved.'));
        } else {
          res.redirect('/admin/contact-settings?error=' + encodeURIComponent('Failed to save settings.'));
        }
      } catch (err) {
        console.error('ContactSettingsController.update:', err);
        res.redirect('/admin/contact-settings?error=' + encodeURIComponent('Save failed.'));
      }
    });
  }
}
