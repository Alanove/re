import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { SiteSettingsService } from './siteSettingsService';

// News interface for admin
export interface AdminNewsData {
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

// News data interface
export interface AdminNewsItemsData {
  news: Record<string, AdminNewsData>;
  site: AdminSiteData;
}

export class NewsService {
  private static instance: NewsService;
  private dataPath: string;
  private newsData: AdminNewsItemsData;
  private siteSettingsService: SiteSettingsService;

  private constructor() {
    this.dataPath = DATA_PATHS.NEWS_FILE;
    this.siteSettingsService = SiteSettingsService.getInstance();
    this.newsData = this.loadNews();
  }

  public static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  /**
   * Load news from JSON file
   */
  private loadNews(): AdminNewsItemsData {
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
      console.error('Error loading news:', error);
      // Get site data from site settings for fallback
      const siteSettings = this.siteSettingsService.getAllSettings();
      return {
        news: {},
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
   * Save news to JSON file
   */
  private saveNews(): void {
    try {
      // Ensure site data is up-to-date before saving
      this.refreshSiteData();
      fs.writeFileSync(this.dataPath, JSON.stringify(this.newsData, null, 2), 'utf8');
      
      // Reload data from file to ensure in-memory data is in sync with what's saved
      this.newsData = this.loadNews();
    } catch (error) {
      console.error('Error saving news:', error);
      throw new Error('Failed to save news data');
    }
  }

  /**
   * Refresh site data from site settings
   */
  private refreshSiteData(): void {
    const siteSettings = this.siteSettingsService.getAllSettings();
    this.newsData.site = {
      name: siteSettings.siteTitle,
      domain: siteSettings.siteUrl,
      description: siteSettings.siteDescription,
      logo: siteSettings.logo,
      favicon: siteSettings.favicon,
      social: siteSettings.socialMedia
    };
  }

  /**
   * Reload news data (useful when site settings are updated)
   */
  public reloadNews(): void {
    this.newsData = this.loadNews();
  }

  /**
   * Get all news items
   */
  public getAllNews(): AdminNewsData[] {
    return Object.values(this.newsData.news);
  }

  /**
   * Get published news items (for public site)
   */
  public getPublishedNews(): AdminNewsData[] {
    return Object.values(this.newsData.news)
      .filter(newsItem => newsItem.status === 'published')
      .sort((a, b) => {
        // Sort by lastUpdated descending (newest first)
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
      });
  }

  /**
   * Get news item by key
   */
  public getNewsByKey(key: string): AdminNewsData | null {
    return this.newsData.news[key] || null;
  }

  /**
   * Get news item by URL
   */
  public getNewsByUrl(url: string): AdminNewsData | null {
    return Object.values(this.newsData.news).find(newsItem => newsItem.url === url) || null;
  }

  /**
   * Create new news item
   */
  public createNews(newsData: Omit<AdminNewsData, 'key'> & { key: string }): AdminNewsData {
    // Check if news key already exists
    if (this.newsData.news[newsData.key]) {
      throw new Error('News item with this key already exists');
    }

    const newNewsItem: AdminNewsData = {
      key: newsData.key,
      title: newsData.title,
      url: newsData.url,
      status: newsData.status || 'draft',
      includeInMenu: newsData.includeInMenu !== undefined ? newsData.includeInMenu : true,
      menuSort: newsData.menuSort || 10,
      lastUpdated: new Date().toISOString(),
      seo: {
        pageTitle: newsData.seo.pageTitle,
        pageDescription: newsData.seo.pageDescription,
        pageKeywords: newsData.seo.pageKeywords,
        pageImage: newsData.seo.pageImage,
        pageType: newsData.seo.pageType
      }
    };

    // Add optional properties only if they exist
    if (newsData.content) newNewsItem.content = newsData.content;
    if (newsData.pageImage) newNewsItem.pageImage = newsData.pageImage;

    this.newsData.news[newsData.key] = newNewsItem;
    this.saveNews();

    return newNewsItem;
  }

  /**
   * Update news item
   */
  public updateNews(key: string, updates: Partial<Omit<AdminNewsData, 'key'>>): AdminNewsData | null {
    const newsItem = this.newsData.news[key];
    
    if (!newsItem) {
      return null;
    }

    // Update news item fields
    if (updates.title !== undefined) newsItem.title = updates.title;
    if (updates.url !== undefined) newsItem.url = updates.url;
    if (updates.content !== undefined) newsItem.content = updates.content;
    if (updates.pageImage !== undefined) {
      if (updates.pageImage === '' || updates.pageImage === null || updates.pageImage === undefined) {
        // Delete the property if empty string, null, or undefined
        // This ensures the property is completely removed from the object
        if ('pageImage' in newsItem) {
          delete newsItem.pageImage;
        }
      } else {
        newsItem.pageImage = updates.pageImage;
      }
    }
    if (updates.status !== undefined) newsItem.status = updates.status;
    if (updates.includeInMenu !== undefined) newsItem.includeInMenu = updates.includeInMenu;
    if (updates.menuSort !== undefined) newsItem.menuSort = updates.menuSort;
    if (updates.seo !== undefined) {
      Object.assign(newsItem.seo, updates.seo);
    }
    
    // Always update the lastUpdated timestamp
    newsItem.lastUpdated = new Date().toISOString();
    
    this.saveNews();
    return newsItem;
  }

  /**
   * Delete news item
   */
  public deleteNews(key: string): boolean {
    if (!this.newsData.news[key]) {
      return false;
    }

    delete this.newsData.news[key];
    this.saveNews();
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
   * Get news count
   */
  public getNewsCount(): number {
    return Object.keys(this.newsData.news).length;
  }

  /**
   * Check if news item exists
   */
  public newsExists(key: string): boolean {
    return !!this.newsData.news[key];
  }

  /**
   * Get empty news item object with default values
   */
  public getEmptyNews(partialData: Partial<AdminNewsData> = {}): AdminNewsData {
    const defaultNews: AdminNewsData = {
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
      ...defaultNews,
      ...partialData,
      seo: {
        ...defaultNews.seo,
        ...partialData.seo
      }
    };
  }

  /**
   * Validate news data
   */
  public validateNewsData(newsData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!newsData.key || newsData.key.trim() === '') {
      errors.push('News key is required');
    }

    if (!newsData.title || newsData.title.trim() === '') {
      errors.push('News title is required');
    }

    if (!newsData.url || newsData.url.trim() === '') {
      errors.push('News URL is required');
    }

    if (!newsData.seo) {
      errors.push('SEO data is required');
    } else {
      if (!newsData.seo.pageTitle || newsData.seo.pageTitle.trim() === '') {
        errors.push('News title for SEO is required');
      }
      if (!newsData.seo.pageDescription || newsData.seo.pageDescription.trim() === '') {
        errors.push('News description for SEO is required');
      }
      if (!newsData.seo.pageKeywords || newsData.seo.pageKeywords.trim() === '') {
        errors.push('News keywords for SEO are required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get news statistics
   */
  public getNewsStatistics(): {
    total: number;
    news: string[];
  } {
    return {
      total: this.getNewsCount(),
      news: Object.keys(this.newsData.news)
    };
  }
}

// Export singleton instance
export const newsService = NewsService.getInstance();

