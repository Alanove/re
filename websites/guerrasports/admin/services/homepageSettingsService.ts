import { db } from '../../src/config/database';

export const DEFAULT_HOMEPAGE_BANNER_IMAGE = '/images/Firefly-2.jpg';
export const DEFAULT_HOMEPAGE_BANNER_TEXT = 'SHOP GUERRA PRODUCTS';
export const DEFAULT_HOMEPAGE_BANNER_LINK = '/products';
export const DEFAULT_NEW_ARRIVALS_TITLE = 'New Arrivals';
export const DEFAULT_SALE_TITLE = 'Sale';
export const DEFAULT_SALE_META_DESCRIPTION = 'Shop products currently on sale at Guerra Sports.';

export interface HomepageSettings {
  bannerImage: string;
  bannerText: string;
  bannerLink: string;
  newArrivalsTitle: string;
  saleTitle: string;
  /** True when the setting has never been saved. */
  saleEnabled: boolean;
  saleMetaTitle: string;
  saleMetaDescription: string;
}

const KEYS = {
  bannerImage: 'homepage_banner_image',
  bannerText: 'homepage_banner_text',
  bannerLink: 'homepage_banner_link',
  newArrivalsTitle: 'homepage_new_arrivals_title',
  saleTitle: 'homepage_sale_title',
  saleEnabled: 'homepage_sale_enabled',
  saleMetaTitle: 'homepage_sale_meta_title',
  saleMetaDescription: 'homepage_sale_meta_description'
} as const;

function cleanText(value: unknown, fallback: string): string {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

/** Relative site paths and http(s) URLs only. */
export function cleanHomepageLink(value: unknown, fallback = DEFAULT_HOMEPAGE_BANNER_LINK): string {
  const text = value == null ? '' : String(value).trim();
  if (!text) return fallback;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') return text;
  } catch {
    // ignore invalid URLs
  }
  return fallback;
}

export class HomepageSettingsService {
  private static instance: HomepageSettingsService;

  private constructor() {}

  public static getInstance(): HomepageSettingsService {
    if (!HomepageSettingsService.instance) {
      HomepageSettingsService.instance = new HomepageSettingsService();
    }
    return HomepageSettingsService.instance;
  }

  public async getSettings(): Promise<HomepageSettings> {
    const defaults: HomepageSettings = {
      bannerImage: DEFAULT_HOMEPAGE_BANNER_IMAGE,
      bannerText: DEFAULT_HOMEPAGE_BANNER_TEXT,
      bannerLink: DEFAULT_HOMEPAGE_BANNER_LINK,
      newArrivalsTitle: DEFAULT_NEW_ARRIVALS_TITLE,
      saleTitle: DEFAULT_SALE_TITLE,
      saleEnabled: true,
      saleMetaTitle: '',
      saleMetaDescription: ''
    };

    try {
      const [rows] = await db.query<any>(
        `SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE 'homepage_%'`
      );
      const map: Record<string, string> = {};
      (rows as any[]).forEach((row) => {
        map[row.setting_key] = row.setting_value == null ? '' : String(row.setting_value);
      });

      const hasEnabled = Object.prototype.hasOwnProperty.call(map, KEYS.saleEnabled);
      const enabledRaw = (map[KEYS.saleEnabled] || '').trim().toLowerCase();

      return {
        bannerImage: cleanText(map[KEYS.bannerImage], defaults.bannerImage),
        bannerText: cleanText(map[KEYS.bannerText], defaults.bannerText),
        bannerLink: cleanHomepageLink(map[KEYS.bannerLink], defaults.bannerLink),
        newArrivalsTitle: cleanText(map[KEYS.newArrivalsTitle], defaults.newArrivalsTitle),
        saleTitle: cleanText(map[KEYS.saleTitle], defaults.saleTitle),
        saleEnabled: hasEnabled ? enabledRaw !== 'false' && enabledRaw !== '0' : true,
        saleMetaTitle: (map[KEYS.saleMetaTitle] || '').trim(),
        saleMetaDescription: (map[KEYS.saleMetaDescription] || '').trim()
      };
    } catch (error) {
      console.error('Error loading homepage settings:', error);
      return defaults;
    }
  }

  public async updateSettings(settings: Partial<HomepageSettings>): Promise<void> {
    const entries: Array<[string, string]> = [];
    if (settings.bannerImage !== undefined) entries.push([KEYS.bannerImage, settings.bannerImage]);
    if (settings.bannerText !== undefined) entries.push([KEYS.bannerText, settings.bannerText]);
    if (settings.bannerLink !== undefined) entries.push([KEYS.bannerLink, settings.bannerLink]);
    if (settings.newArrivalsTitle !== undefined) entries.push([KEYS.newArrivalsTitle, settings.newArrivalsTitle]);
    if (settings.saleTitle !== undefined) entries.push([KEYS.saleTitle, settings.saleTitle]);
    if (settings.saleEnabled !== undefined) entries.push([KEYS.saleEnabled, settings.saleEnabled ? 'true' : 'false']);
    if (settings.saleMetaTitle !== undefined) entries.push([KEYS.saleMetaTitle, settings.saleMetaTitle]);
    if (settings.saleMetaDescription !== undefined) entries.push([KEYS.saleMetaDescription, settings.saleMetaDescription]);

    for (const [settingKey, settingValue] of entries) {
      await db.query(
        `INSERT INTO site_settings (setting_key, setting_value, setting_type, updated_at)
         VALUES (?, ?, 'string', NOW())
         ON DUPLICATE KEY UPDATE setting_value = ?, setting_type = 'string', updated_at = NOW()`,
        [settingKey, settingValue, settingValue]
      );
    }
  }
}
