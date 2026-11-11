import { db } from '../../src/config/database';
import type { ContactLocation } from '../../src/types/contactLocation';
import { INTEGRATION_SETTING_PREFIX } from './integrationSettingsService';

interface SiteSettings {
  siteTitle: string;
  siteSlogan?: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  siteImage?: string;
  siteUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp?: string;
  address: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
    defaultKeywords: string;
  };
  downloadLinks: {
    portfolio?: string;
    brochure?: string;
    catalog?: string;
  };
  googleMaps: {
    embedUrl?: string;
    directionsUrl?: string;
    latitude?: string;
    longitude?: string;
  };
  /** Raw HTML/script for analytics (e.g. Google Analytics) - injected in head */
  analyticsScript?: string;
  /** Boutiques / regions shown on Contact Us (managed under Contact Settings) */
  contactLocations?: ContactLocation[];
  /**
   * Index into contactLocations whose details are shown in the storefront footer (Get In Touch).
   * Null / unset means use primary contact fields (contactEmail, contactPhone, address).
   */
  footerMainLocationIndex?: number | null;
}

export class SiteSettingsService {
  private static instance: SiteSettingsService;
  private settingsCache: SiteSettings | null = null;
  private cacheTime: number = 0;
  private cacheDuration: number = 5000; // 5 seconds

  private constructor() { }

  public static getInstance(): SiteSettingsService {
    if (!SiteSettingsService.instance) {
      SiteSettingsService.instance = new SiteSettingsService();
    }
    return SiteSettingsService.instance;
  }

  /**
   * Load site settings from database
   */
  private async loadSettings(): Promise<SiteSettings> {
    // Return cached settings if still valid
    if (this.settingsCache && (Date.now() - this.cacheTime) < this.cacheDuration) {
      return this.settingsCache;
    }

    try {
      const [rows] = await db.query(`
        SELECT setting_key, setting_value, setting_type
        FROM site_settings
      `);

      const settings: any = {};

      for (const row of rows as any[]) {
        const key = row.setting_key;
        if (typeof key === 'string' && key.startsWith(INTEGRATION_SETTING_PREFIX)) continue;
        settings[key] = this.coerceSettingValue(row.setting_type, row.setting_value);
      }

      // Merge with defaults
      const merged: SiteSettings = { ...this.getDefaultSettings(), ...settings };
      const anySettings = settings as Record<string, unknown>;
      const rawContactLocs =
        merged.contactLocations ??
        anySettings.contact_locations ??
        anySettings.contactlocations;
      merged.contactLocations = this.sanitizeContactLocations(rawContactLocs);
      merged.footerMainLocationIndex = this.normalizeFooterMainLocationIndex(
        merged.footerMainLocationIndex,
        merged.contactLocations.length
      );
      this.settingsCache = merged;
      this.cacheTime = Date.now();

      return merged;
    } catch (error) {
      console.error('Error loading site settings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Save settings to database
   */
  private async saveSetting(key: string, value: any): Promise<void> {
    try {
      const settingType = typeof value;
      const settingValue = typeof value === 'string' ? value : JSON.stringify(value);

      // Try update first, then insert if not exists
      const [result] = await db.query(`
        UPDATE site_settings 
        SET setting_value = ?, setting_type = ?
        WHERE setting_key = ?
      `, [settingValue, settingType, key]);

      if ((result as any).affectedRows === 0) {
        await db.query(`
          INSERT INTO site_settings (setting_key, setting_value, setting_type)
          VALUES (?, ?, ?)
        `, [key, settingValue, settingType]);
      }

      // Invalidate cache
      this.settingsCache = null;
    } catch (error) {
      console.error('Error saving setting:', error);
      throw error;
    }
  }

  /**
   * Get default site settings
   */
  private getDefaultSettings(): SiteSettings {
    return {
      siteTitle: '',
      siteSlogan: '',
      siteDescription: '',
      logo: '/images/logo.jpg',
      favicon: '/images/favicon.ico',
      siteImage: '/images/site-image.jpg',
      siteUrl: '',
      contactEmail: '',
      contactPhone: '',
      contactWhatsapp: '',
      address: '',
      socialMedia: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        youtube: ''
      },
      seo: {
        defaultTitle: '',
        defaultDescription: '',
        defaultKeywords: ''
      },
      downloadLinks: {
        portfolio: '',
        brochure: '',
        catalog: ''
      },
      googleMaps: {
        embedUrl: '',
        directionsUrl: '',
        latitude: '',
        longitude: ''
      },
      analyticsScript: '',
      contactLocations: [],
      footerMainLocationIndex: null
    };
  }

  /**
   * Normalize DB value: keep non-JSON scalars; parse JSON strings; accept already-parsed objects/arrays
   * (avoids corrupting arrays via JSON.parse(String([object Object]))).
   */
  private coerceSettingValue(settingType: string | null | undefined, raw: unknown): unknown {
    let value: unknown = raw;
    if (Buffer.isBuffer(value)) {
      value = value.toString('utf8');
    }
    if (value !== null && typeof value === 'object') {
      return value;
    }
    const strVal = typeof value === 'string' ? value.trim().replace(/^\uFEFF/, '') : '';
    const looksJson =
      strVal.length > 0 && (strVal.startsWith('{') || strVal.startsWith('['));
    if (settingType === 'object' || looksJson) {
      if (typeof value !== 'string') {
        return value;
      }
      try {
        let parsed: unknown = JSON.parse(strVal);
        let depth = 0;
        while (
          depth < 4 &&
          typeof parsed === 'string' &&
          parsed.trim().length > 0 &&
          (parsed.trim().startsWith('{') || parsed.trim().startsWith('['))
        ) {
          const inner = parsed.trim().replace(/^\uFEFF/, '');
          try {
            parsed = JSON.parse(inner);
            depth++;
          } catch {
            break;
          }
        }
        return parsed;
      } catch {
        return value;
      }
    }
    return value;
  }

  private normalizeFooterMainLocationIndex(raw: unknown, locationCount: number): number | null {
    if (raw === null || raw === undefined || raw === '' || raw === false) return null;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
    if (Number.isNaN(n) || n < 0 || n >= locationCount) return null;
    return n;
  }

  /** Normalize DB / legacy shapes into an array before mapping to ContactLocation */
  private normalizeContactLocationsArray(raw: unknown): unknown[] {
    if (raw == null) return [];
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return [];
      try {
        const p = JSON.parse(t);
        return this.normalizeContactLocationsArray(p);
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') {
      return Object.keys(raw as Record<string, unknown>)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (raw as Record<string, unknown>)[k])
        .filter((item): item is object => item != null && typeof item === 'object');
    }
    return [];
  }

  private stringListFromField(raw: unknown): string[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((x: any) => String(x).trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    const one = String(raw).trim();
    return one ? [one] : [];
  }

  private sanitizeContactLocations(raw: unknown): ContactLocation[] {
    const arr = this.normalizeContactLocationsArray(raw);
    return arr
      .filter((x) => x && typeof x === 'object')
      .map((x: any) => {
        const addrRaw = x.addressLines ?? x.address_lines ?? x.address ?? '';
        const phoneRaw = x.phones ?? x.phone_numbers ?? x.phone ?? '';
        const emailRaw = x.emails ?? x.email ?? '';
        const addressLines = this.stringListFromField(addrRaw);
        const phones = this.stringListFromField(phoneRaw);
        const emails = this.stringListFromField(emailRaw);
        const loc: ContactLocation = {
          label: String(x.label ?? x.title ?? '').trim(),
          addressLines,
          phones,
          emails
        };
        const mapUrl = String(x.mapUrl ?? x.map_url ?? '').trim();
        if (mapUrl) loc.mapUrl = mapUrl;
        return loc;
      })
      .filter(
        (loc) =>
          loc.label ||
          loc.addressLines.length ||
          loc.phones.length ||
          loc.emails.length ||
          !!loc.mapUrl
      );
  }

  /**
   * Get all site settings
   */
  public async getAllSettings(): Promise<SiteSettings> {
    return await this.loadSettings();
  }

  /**
   * Get site title
   */
  public async getSiteTitle(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.siteTitle;
  }

  /**
   * Get site description
   */
  public async getSiteDescription(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.siteDescription;
  }

  /**
   * Get site URL
   */
  public async getSiteUrl(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.siteUrl;
  }

  /**
   * Get contact email
   */
  public async getContactEmail(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.contactEmail;
  }

  /**
   * Get contact phone
   */
  public async getContactPhone(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.contactPhone;
  }

  /**
   * Get contact whatsapp
   */
  public async getContactWhatsapp(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.contactWhatsapp || '';
  }

  /**
   * Get address
   */
  public async getAddress(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.address;
  }

  /**
   * Get social media links
   */
  public async getSocialMedia(): Promise<SiteSettings['socialMedia']> {
    const settings = await this.loadSettings();
    return settings.socialMedia;
  }

  /**
   * Get SEO settings
   */
  public async getSeoSettings(): Promise<SiteSettings['seo']> {
    const settings = await this.loadSettings();
    return settings.seo;
  }

  /**
   * Get download links
   */
  public async getDownloadLinks(): Promise<SiteSettings['downloadLinks']> {
    const settings = await this.loadSettings();
    return settings.downloadLinks;
  }

  /**
   * Get Google Maps settings
   */
  public async getGoogleMapsSettings(): Promise<SiteSettings['googleMaps']> {
    const settings = await this.loadSettings();
    return settings.googleMaps;
  }

  /**
   * Update site settings
   */
  public async updateSettings(newSettings: Partial<SiteSettings>): Promise<boolean> {
    try {
      // Flatten nested objects and save each setting
      for (const [key, value] of Object.entries(newSettings)) {
        let v: any = value;
        if (key === 'footerMainLocationIndex' && (v === null || v === undefined)) {
          v = '';
        }
        await this.saveSetting(key, v);
      }

      // Invalidate cache
      this.settingsCache = null;

      return true;
    } catch (error) {
      console.error('Error updating site settings:', error);
      return false;
    }
  }

  /**
   * Reload settings from database (clear cache)
   */
  public reloadSettings(): void {
    this.settingsCache = null;
    this.cacheTime = 0;
  }
}
