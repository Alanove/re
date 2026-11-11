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

    let siteSettings: SiteSettings | null = null;
    try {
      const siteSettingsData = fs.readFileSync(DATA_PATHS.SITE_SETTINGS_FILE, 'utf8');
      siteSettings = JSON.parse(siteSettingsData) as SiteSettings;
    } catch (error) {
      console.error('Error reading site settings for SEO:', error);
    }

    const trim = (s: string | undefined) => (s || '').trim();
    const defaultMetaTitle = trim(siteSettings?.seo?.defaultTitle);
    const settingsSiteTitle = trim(siteSettings?.siteTitle);
    const globalTitleFallback =
      defaultMetaTitle || settingsSiteTitle || trim(siteData.name) || '';
    const globalDescription =
      trim(siteSettings?.seo?.defaultDescription) ||
      trim(siteSettings?.siteDescription) ||
      trim(siteData.description) ||
      '';
    const globalKeywords = trim(siteSettings?.seo?.defaultKeywords);

    if (!pageData) {
      return {
        pageTitle: customData.pageTitle || globalTitleFallback || 'Home',
        pageDescription: customData.pageDescription || globalDescription,
        pageKeywords: customData.pageKeywords || globalKeywords || '',
        pageUrl: customData.pageUrl || siteData.domain,
        pageImage: customData.pageImage || siteData.logo,
        pageType: customData.pageType || 'website',
        pageRobots: customData.pageRobots || 'index, follow'
      };
    }

    const pageSeoTitle = trim(pageData.seo?.pageTitle);
    const pageTitleField = trim(pageData.title);

    // Home: Site Title in settings is the primary brand tab title; then default SEO title; then CMS page SEO.
    const resolvedTitle =
      customData.pageTitle ||
      (pageKey === 'home'
        ? settingsSiteTitle || defaultMetaTitle || pageSeoTitle || pageTitleField
        : pageSeoTitle || pageTitleField || globalTitleFallback);

    const pageSeoDesc = trim(pageData.seo?.pageDescription);
    const resolvedDescription =
      customData.pageDescription ||
      pageSeoDesc ||
      globalDescription ||
      trim(siteData.description);

    const pageSeoKeywords = trim(pageData.seo?.pageKeywords);
    const resolvedKeywords =
      customData.pageKeywords || pageSeoKeywords || globalKeywords || '';

    return {
      pageTitle: resolvedTitle,
      pageDescription: resolvedDescription,
      pageKeywords: resolvedKeywords,
      pageUrl: customData.pageUrl || `${siteData.domain}${pageData.url}`,
      pageImage: customData.pageImage || pageData.seo.pageImage,
      pageType: customData.pageType || pageData.seo.pageType,
      pageRobots: customData.pageRobots || 'index, follow'
    };
  }

  getPageKeyFromPath(path: string): string {
    if (path === '/') return 'home';
    if (path.startsWith('/about')) return 'about';
    if (path.startsWith('/services')) return 'services';
    if (path.startsWith('/projects')) return 'projects';
    if (path.startsWith('/contact')) return 'contact';
    if (path.startsWith('/past-and-present')) return 'past-and-present';
    return 'home';
  }
}

/**
 * Public document title: non-home pages get " - {siteName}" unless already suffixed (e.g. controllers using " | Site").
 */
export function formatDocumentTitle(
  pageTitle: string | undefined,
  siteName: string | undefined,
  isHome: boolean | undefined
): string {
  const t = (pageTitle || '').trim();
  const s = (siteName || '').trim();
  if (!t) return '';
  if (isHome === true || !s) return t;
  const lower = t.toLowerCase();
  const withDash = ` - ${s}`.toLowerCase();
  const withPipe = ` | ${s}`.toLowerCase();
  if (lower.endsWith(withDash) || lower.endsWith(withPipe)) return t;
  return `${t} - ${s}`;
}

export default new PagesService(); 