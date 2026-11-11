import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { SiteSettingsService } from './siteSettingsService';

// Page interface for admin
export interface AdminPageData {
  key: string;
  title: string;
  url: string;
  content?: string;
  pageImage?: string;
  status?: 'published' | 'draft';
  includeInMenu?: boolean;
  menuSort?: number;
  lastUpdated?: string;
  seo: {
    pageTitle: string;
    pageDescription: string;
    pageKeywords: string;
    pageImage: string;
    pageType: string;
  };
}

// Site data interface
export interface AdminSiteData {
  name: string;
  domain: string;
  description: string;
  logo: string;
  favicon: string;
  social: {
    linkedin?: string;
    facebook?: string;
  };
}

// Pages data interface
export interface AdminPagesData {
  pages: Record<string, AdminPageData>;
  site: AdminSiteData;
}

export class PagesService {
  private static instance: PagesService;
  private dataPath: string;
  private pagesData: AdminPagesData;
  private siteSettingsService: SiteSettingsService;

  private constructor() {
    this.dataPath = DATA_PATHS.PAGES_FILE;
    this.siteSettingsService = SiteSettingsService.getInstance();
    this.pagesData = this.loadPages();
  }

  public static getInstance(): PagesService {
    if (!PagesService.instance) {
      PagesService.instance = new PagesService();
    }
    return PagesService.instance;
  }

  /**
   * Load pages from JSON file
   */
  private loadPages(): AdminPagesData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Ensure site data is always up-to-date from site settings
      const siteSettings = this.siteSettingsService.getAllSettings();
      parsedData.site = {
        name: siteSettings.siteTitle,
        domain: siteSettings.siteUrl,
        description: siteSettings.siteDescription,
        logo: siteSettings.logo,
        favicon: siteSettings.favicon,
        social: siteSettings.socialMedia
      };
      
      return parsedData;
    } catch (error) {
      console.error('Error loading pages:', error);
      // Get site data from site settings for fallback
      const siteSettings = this.siteSettingsService.getAllSettings();
      return {
        pages: {},
        site: {
          name: siteSettings.siteTitle,
          domain: siteSettings.siteUrl,
          description: siteSettings.siteDescription,
          logo: siteSettings.logo,
          favicon: siteSettings.favicon,
          social: siteSettings.socialMedia
        }
      };
    }
  }

  /**
   * Save pages to JSON file
   */
  private savePages(): void {
    try {
      // Ensure site data is up-to-date before saving
      this.refreshSiteData();
      fs.writeFileSync(this.dataPath, JSON.stringify(this.pagesData, null, 2), 'utf8');
      
      // Reload data from file to ensure in-memory data is in sync with what's saved
      this.pagesData = this.loadPages();
    } catch (error) {
      console.error('Error saving pages:', error);
      throw new Error('Failed to save pages data');
    }
  }

  /**
   * Refresh site data from site settings
   */
  private refreshSiteData(): void {
    const siteSettings = this.siteSettingsService.getAllSettings();
    this.pagesData.site = {
      name: siteSettings.siteTitle,
      domain: siteSettings.siteUrl,
      description: siteSettings.siteDescription,
      logo: siteSettings.logo,
      favicon: siteSettings.favicon,
      social: siteSettings.socialMedia
    };
  }

  /**
   * Reload pages data (useful when site settings are updated)
   */
  public reloadPages(): void {
    this.pagesData = this.loadPages();
  }

  /**
   * Get all pages
   */
  public getAllPages(): AdminPageData[] {
    return Object.values(this.pagesData.pages);
  }

  /**
   * Get page by key
   */
  public getPageByKey(key: string): AdminPageData | null {
    return this.pagesData.pages[key] || null;
  }

  /**
   * Get page by URL
   */
  public getPageByUrl(url: string): AdminPageData | null {
    return Object.values(this.pagesData.pages).find(page => page.url === url) || null;
  }

  /**
   * Create new page
   */
  public createPage(pageData: Omit<AdminPageData, 'key'> & { key: string }): AdminPageData {
    // Check if page key already exists
    if (this.pagesData.pages[pageData.key]) {
      throw new Error('Page with this key already exists');
    }

    const newPage: AdminPageData = {
      key: pageData.key,
      title: pageData.title,
      url: pageData.url,
      status: pageData.status || 'draft',
      includeInMenu: pageData.includeInMenu !== undefined ? pageData.includeInMenu : true,
      menuSort: pageData.menuSort || 10,
      lastUpdated: new Date().toISOString(),
      seo: {
        pageTitle: pageData.seo.pageTitle,
        pageDescription: pageData.seo.pageDescription,
        pageKeywords: pageData.seo.pageKeywords,
        pageImage: pageData.seo.pageImage,
        pageType: pageData.seo.pageType
      }
    };

    // Add optional properties only if they exist
    if (pageData.content) newPage.content = pageData.content;
    if (pageData.pageImage) newPage.pageImage = pageData.pageImage;

    this.pagesData.pages[pageData.key] = newPage;
    this.savePages();

    return newPage;
  }

  /**
   * Update page
   */
  public updatePage(key: string, updates: Partial<Omit<AdminPageData, 'key'>>): AdminPageData | null {
    const page = this.pagesData.pages[key];
    
    if (!page) {
      return null;
    }

    // Update page fields
    if (updates.title !== undefined) page.title = updates.title;
    if (updates.url !== undefined) page.url = updates.url;
    if (updates.content !== undefined) page.content = updates.content;
    if (updates.pageImage !== undefined) {
      if (updates.pageImage === '' || updates.pageImage === null || updates.pageImage === undefined) {
        // Delete the property if empty string, null, or undefined
        // This ensures the property is completely removed from the object
        if ('pageImage' in page) {
          delete page.pageImage;
        }
      } else {
        page.pageImage = updates.pageImage;
      }
    }
    if (updates.status !== undefined) page.status = updates.status;
    if (updates.includeInMenu !== undefined) page.includeInMenu = updates.includeInMenu;
    if (updates.menuSort !== undefined) page.menuSort = updates.menuSort;
    if (updates.seo !== undefined) {
      Object.assign(page.seo, updates.seo);
    }
    
    // Always update the lastUpdated timestamp
    page.lastUpdated = new Date().toISOString();
    
    this.savePages();
    return page;
  }

  /**
   * Delete page
   */
  public deletePage(key: string): boolean {
    if (!this.pagesData.pages[key]) {
      return false;
    }

    delete this.pagesData.pages[key];
    this.savePages();
    return true;
  }

  /**
   * Get site data (always fresh from site settings)
   */
  public getSiteData(): AdminSiteData {
    const siteSettings = this.siteSettingsService.getAllSettings();
    return {
      name: siteSettings.siteTitle,
      domain: siteSettings.siteUrl,
      description: siteSettings.siteDescription,
      logo: siteSettings.logo,
      favicon: siteSettings.favicon,
      social: siteSettings.socialMedia
    };
  }

  /**
   * Get pages count
   */
  public getPagesCount(): number {
    return Object.keys(this.pagesData.pages).length;
  }

  /**
   * Check if page exists
   */
  public pageExists(key: string): boolean {
    return !!this.pagesData.pages[key];
  }

  /**
   * Get empty page object with default values
   */
  public getEmptyPage(partialData: Partial<AdminPageData> = {}): AdminPageData {
    const defaultPage: AdminPageData = {
      key: '',
      title: '',
      url: '',
      content: '',
      pageImage: '',
      status: 'draft',
      includeInMenu: true,
      menuSort: 1000,
      seo: {
        pageTitle: '',
        pageDescription: '',
        pageKeywords: '',
        pageImage: '',
        pageType: 'website'
      }
    };

    // Merge partial data with defaults
    return {
      ...defaultPage,
      ...partialData,
      seo: {
        ...defaultPage.seo,
        ...partialData.seo
      }
    };
  }

  /**
   * Validate page data
   */
  public validatePageData(pageData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pageData.key || pageData.key.trim() === '') {
      errors.push('Page key is required');
    }

    if (!pageData.title || pageData.title.trim() === '') {
      errors.push('Page title is required');
    }

    if (!pageData.url || pageData.url.trim() === '') {
      errors.push('Page URL is required');
    }

    if (!pageData.seo) {
      errors.push('SEO data is required');
    } else {
      if (!pageData.seo.pageTitle || pageData.seo.pageTitle.trim() === '') {
        errors.push('Page title for SEO is required');
      }
      if (!pageData.seo.pageDescription || pageData.seo.pageDescription.trim() === '') {
        errors.push('Page description for SEO is required');
      }
      if (!pageData.seo.pageKeywords || pageData.seo.pageKeywords.trim() === '') {
        errors.push('Page keywords for SEO are required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get page statistics
   */
  public getPageStatistics(): {
    total: number;
    pages: string[];
  } {
    return {
      total: this.getPagesCount(),
      pages: Object.keys(this.pagesData.pages)
    };
  }
}

// Export singleton instance
export const pagesService = PagesService.getInstance(); 