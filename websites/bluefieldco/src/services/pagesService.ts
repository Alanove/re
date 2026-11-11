import * as fs from 'fs';
import { DATA_PATHS } from '../constants';
import {
  PagesData,
  MenuItem,
  PageData,
  SiteData,
  SeoData,
  IPagesService
} from '../types';

interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  siteImage?: string;
  siteUrl: string;
  contactEmail: string;
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
}

class PagesService implements IPagesService {
  private readonly dataPath: string;

  constructor() {
    this.dataPath = DATA_PATHS.PAGES_FILE;
  }

  getPagesData(): PagesData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data) as PagesData;
    } catch (error) {
      console.error('Error reading pages.json:', error);
      return { pages: {}, site: {} as SiteData };
    }
  }

  getMenuItems(): MenuItem[] {
    // Import and use the updated menuService that reads from admin system
    const { getMenuItems } = require('./menuService');
    return getMenuItems();
  }

  getPageData(pageKey: string): PageData | null {
    const pagesData = this.getPagesData();
    return pagesData.pages[pageKey] || null;
  }

  normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  }

  getPageByUrl(requestPath: string): PageData | null {
    const normalized = this.normalizePath(requestPath);
    const pagesData = this.getPagesData();
    for (const page of Object.values(pagesData.pages)) {
      if (this.normalizePath(page.url) === normalized) {
        return page;
      }
    }
    return null;
  }

  getPageKeyByUrl(requestPath: string): string | null {
    const page = this.getPageByUrl(requestPath);
    return page?.key || null;
  }

  getSiteData(): SiteData {
    const pagesData = this.getPagesData();
    const baseSiteData = pagesData.site || {} as SiteData;
    
    // Read site settings to get the latest favicon and other settings
    try {
      const siteSettingsData = fs.readFileSync(DATA_PATHS.SITE_SETTINGS_FILE, 'utf8');
      const siteSettings: SiteSettings = JSON.parse(siteSettingsData);
      
      // Merge site settings with base site data
      return {
        ...baseSiteData,
        name: siteSettings.siteTitle || baseSiteData.name,
        description: siteSettings.siteDescription || baseSiteData.description,
        logo: siteSettings.logo || baseSiteData.logo,
        favicon: siteSettings.favicon || baseSiteData.favicon,
        domain: siteSettings.siteUrl || baseSiteData.domain,
        social: {
          facebook: siteSettings.socialMedia?.facebook || baseSiteData.social?.facebook || '',
          linkedin: siteSettings.socialMedia?.linkedin || baseSiteData.social?.linkedin || '',
          twitter: siteSettings.socialMedia?.twitter || baseSiteData.social?.twitter || '',
          instagram: siteSettings.socialMedia?.instagram || baseSiteData.social?.instagram || ''
        }
      };
    } catch (error) {
      console.error('Error reading site settings:', error);
      return baseSiteData;
    }
  }

  getSeoData(pageKey: string, customData: Partial<SeoData> = {}): SeoData {
    const pageData = this.getPageData(pageKey);
    const siteData = this.getSiteData();
    
    if (!pageData) {
      return {
        pageTitle: siteData.name || 'BlueField Group',
        pageDescription: siteData.description || '',
        pageKeywords: 'BlueField, agriculture, pest management, landscaping, cleaning, MENA',
        pageUrl: customData.pageUrl || siteData.domain,
        pageImage: siteData.logo,
        pageType: 'website',
        pageRobots: 'index, follow'
      };
    }
    
    return {
      pageTitle: customData.pageTitle || pageData.seo.pageTitle || pageData.title,
      pageDescription: customData.pageDescription || pageData.seo.pageDescription || '',
      pageKeywords: customData.pageKeywords || pageData.seo.pageKeywords,
      pageUrl: customData.pageUrl || `${siteData.domain}${pageData.url}`,
      pageImage: customData.pageImage || pageData.seo.pageImage,
      pageType: customData.pageType || pageData.seo.pageType,
      pageRobots: customData.pageRobots || 'index, follow'
    };
  }

  getPageKeyFromPath(requestPath: string): string {
    const normalized = this.normalizePath(requestPath);
    if (normalized === '/') return 'home';
    if (normalized === '/search') return 'search';
    if (normalized === '/news' || normalized.startsWith('/news/')) {
      if (normalized.startsWith('/news/')) {
        return normalized.slice('/news/'.length);
      }
      return 'news-listing';
    }
    const byUrl = this.getPageKeyByUrl(normalized);
    if (byUrl) return byUrl;
    return normalized.slice(1).replace(/\//g, '-') || 'home';
  }
}

export default new PagesService(); 