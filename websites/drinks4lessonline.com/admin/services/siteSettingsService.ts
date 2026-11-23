import { db } from '../../src/config/database';

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

      // Merge with defaults
      this.settingsCache = { ...this.getDefaultSettings(), ...settings };
      this.cacheTime = Date.now();

      return this.settingsCache!;
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
      analyticsScript: ''
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
