import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../../src/constants';

interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  siteImage?: string;
  siteUrl: string;
  contactEmail: string;
  careersEmail?: string;
  contactPhone: string;
  address: string;
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
}

export class SiteSettingsService {
  private static instance: SiteSettingsService;
  private settingsPath: string;
  private settings: SiteSettings | null = null;
  private lastModified: number = 0;

  private constructor() {
    this.settingsPath = DATA_PATHS.SITE_SETTINGS_FILE;
  }

  public static getInstance(): SiteSettingsService {
    if (!SiteSettingsService.instance) {
      SiteSettingsService.instance = new SiteSettingsService();
    }
    return SiteSettingsService.instance;
  }

  /**
   * Load site settings from JSON file
   */
  private loadSettings(): SiteSettings {
    try {
      // Check if file exists and get its modification time
      if (fs.existsSync(this.settingsPath)) {
        const stats = fs.statSync(this.settingsPath);
        const currentModified = stats.mtime.getTime();
        
        // If file has been modified since last load, or settings are null, reload
        if (!this.settings || currentModified > this.lastModified) {
          const data = fs.readFileSync(this.settingsPath, 'utf8');
          this.settings = JSON.parse(data);
          this.lastModified = currentModified;
        }
      } else {
        // Create default settings if file doesn't exist
        this.settings = this.getDefaultSettings();
        this.saveSettings();
      }
    } catch (error) {
      console.error('Error loading site settings:', error);
      this.settings = this.getDefaultSettings();
    }

    return this.settings!;
  }

  /**
   * Save settings to JSON file
   */
  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      
      // Update last modified time
      if (fs.existsSync(this.settingsPath)) {
        const stats = fs.statSync(this.settingsPath);
        this.lastModified = stats.mtime.getTime();
      }
    } catch (error) {
      console.error('Error saving site settings:', error);
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
      careersEmail: '',
      contactPhone: '',
      address: '',
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
      }
    };
  }

  /**
   * Get all site settings
   */
  public getAllSettings(): SiteSettings {
    return this.loadSettings() || this.getDefaultSettings();
  }

  /**
   * Get site title
   */
  public getSiteTitle(): string {
    return this.loadSettings().siteTitle;
  }

  /**
   * Get site description
   */
  public getSiteDescription(): string {
    return this.loadSettings().siteDescription;
  }

  /**
   * Get site URL
   */
  public getSiteUrl(): string {
    return this.loadSettings().siteUrl;
  }

  /**
   * Get contact email
   */
  public getContactEmail(): string {
    return this.loadSettings().contactEmail;
  }

  /**
   * Get careers email
   */
  public getCareersEmail(): string {
    return this.loadSettings().careersEmail || '';
  }

  /**
   * Get contact phone
   */
  public getContactPhone(): string {
    return this.loadSettings().contactPhone;
  }

  /**
   * Get address
   */
  public getAddress(): string {
    return this.loadSettings().address;
  }

  /**
   * Get social media links
   */
  public getSocialMedia(): SiteSettings['socialMedia'] {
    return this.loadSettings().socialMedia;
  }

  /**
   * Get SEO settings
   */
  public getSeoSettings(): SiteSettings['seo'] {
    return this.loadSettings().seo;
  }

  /**
   * Get download links
   */
  public getDownloadLinks(): SiteSettings['downloadLinks'] {
    return this.loadSettings().downloadLinks;
  }

  /**
   * Update site settings
   */
  public updateSettings(newSettings: Partial<SiteSettings>): boolean {
    try {
      const currentSettings = this.loadSettings();
      this.settings = { ...currentSettings, ...newSettings };
      this.saveSettings();
      
      // Force reload to ensure we have the latest data
      this.settings = null;
      this.lastModified = 0;
      
      return true;
    } catch (error) {
      console.error('Error updating site settings:', error);
      return false;
    }
  }

  /**
   * Reload settings from file (useful for development)
   */
  public reloadSettings(): void {
    this.settings = null;
    this.lastModified = 0;
    this.loadSettings();
  }
} 