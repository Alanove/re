import { db } from '../../src/config/database';

export interface PaymentSettings {
  whishEnabled: boolean;
  whishDetails: string;
  omtEnabled: boolean;
  omtDetails: string;
  bankTransferEnabled: boolean;
  bankInfo: string;
}

interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  siteImage?: string;
  siteUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsApp: string;
  address: string;
  janitorName: string;
  janitorPhone: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
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
  payments: PaymentSettings;
  /** Full analytics HTML/script snippet (e.g. Google Analytics / GTM). Injected on public pages after cookie consent. */
  analytics: string;
}

export class SiteSettingsService {
  private static instance: SiteSettingsService;
  private settingsCache: SiteSettings | null = null;
  private cacheTime: number = 0;
  private cacheDuration: number = 5000; // 5 seconds

  private constructor() {}

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
        let value = row.setting_value;
        
        // Parse JSON values
        if (row.setting_type === 'object' || (value && (value.startsWith('{') || value.startsWith('[')))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
        
        settings[key] = value;
      }

      // Merge with defaults (deep-merge nested payment settings)
      const defaults = this.getDefaultSettings();
      this.settingsCache = {
        ...defaults,
        ...settings,
        payments: {
          ...defaults.payments,
          ...(settings.payments && typeof settings.payments === 'object' ? settings.payments : {})
        },
        socialMedia: {
          ...defaults.socialMedia,
          ...(settings.socialMedia && typeof settings.socialMedia === 'object' ? settings.socialMedia : {})
        },
        seo: {
          ...defaults.seo,
          ...(settings.seo && typeof settings.seo === 'object' ? settings.seo : {})
        },
        downloadLinks: {
          ...defaults.downloadLinks,
          ...(settings.downloadLinks && typeof settings.downloadLinks === 'object' ? settings.downloadLinks : {})
        },
        googleMaps: {
          ...defaults.googleMaps,
          ...(settings.googleMaps && typeof settings.googleMaps === 'object' ? settings.googleMaps : {})
        }
      };
      this.cacheTime = Date.now();

      return this.settingsCache as SiteSettings;
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
      siteDescription: '',
      logo: '/images/logo.jpg',
      favicon: '/images/favicon.ico',
      siteImage: '/images/site-image.jpg',
      siteUrl: '',
      contactEmail: '',
      contactPhone: '',
      contactWhatsApp: '',
      address: '',
      janitorName: '',
      janitorPhone: '',
      socialMedia: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: ''
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
      payments: {
        whishEnabled: false,
        whishDetails: '',
        omtEnabled: false,
        omtDetails: '',
        bankTransferEnabled: false,
        bankInfo: ''
      },
      analytics: ''
    };
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
   * Read a raw site_settings value by key (for non-typed operational keys).
   */
  public async getRawSettingValue(key: string): Promise<string | null> {
    try {
      const [rows] = await db.query(
        `SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1`,
        [key]
      );
      const row = (rows as any[])[0];
      return row ? String(row.setting_value) : null;
    } catch (error) {
      console.error('Error reading site setting:', error);
      return null;
    }
  }

  /**
   * Upsert a raw site_settings string value by key.
   */
  public async setRawSettingValue(key: string, value: string): Promise<void> {
    await this.saveSetting(key, value);
  }

  /**
   * Get contact phone
   */
  public async getContactPhone(): Promise<string> {
    const settings = await this.loadSettings();
    return settings.contactPhone;
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
        await this.saveSetting(key, value);
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
