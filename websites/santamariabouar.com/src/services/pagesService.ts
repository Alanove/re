// Public-facing pages service - delegates to admin service
import { PagesService as AdminPagesService, Page } from '../../admin/services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { MenuService } from '../../admin/services/menuService';
import { MenuItem, SiteData, SeoData, PageData, PagesData } from '../types';

const adminPagesService = AdminPagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const menuService = MenuService.getInstance();

export class PagesService {
  private static instance: PagesService;
  private cachedSettings: any = null;
  private cachedMenu: MenuItem[] = [];
  private cacheTime: number = 0;
  private cacheDuration: number = 30000; // 30 seconds

  private constructor() {}

  public static getInstance(): PagesService {
    if (!PagesService.instance) {
      PagesService.instance = new PagesService();
    }
    return PagesService.instance;
  }

  private async loadCache() {
    const now = Date.now();
    if (!this.cachedSettings || (now - this.cacheTime) > this.cacheDuration) {
      this.cachedSettings = await siteSettingsService.getAllSettings();
      const menus = await menuService.getAllMenus();
      
      // Find the main menu and convert it to the expected format
      const mainMenu = menus.find(m => m.name === 'Main Menu');
      if (mainMenu) {
        this.cachedMenu = this.convertMenuItems(mainMenu.items);
      } else {
        // Fallback to first menu if Main Menu not found
        this.cachedMenu = menus.length > 0 ? this.convertMenuItems(menus[0].items) : [];
      }
      this.cacheTime = now;
    }
  }

  private convertMenuItems(items: any[]): MenuItem[] {
    return items.map(item => ({
      key: item.id,
      title: item.title,
      url: item.link ? (item.link.startsWith('/') ? item.link : `/${item.link}`) : `/${item.id}`,
      id: item.id,
      active: item.active,
      children: item.children ? this.convertMenuItems(item.children) : []
    }));
  }

  async getAllPages(): Promise<Page[]> {
    return await adminPagesService.getPublishedPages();
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    const page = await adminPagesService.getPageBySlug(slug);
    if (page && page.status === 'published') {
      return page;
    }
    return null;
  }

  async getPageById(id: number): Promise<Page | null> {
    const page = await adminPagesService.getPageById(id);
    if (page && page.status === 'published') {
      return page;
    }
    return null;
  }

  // Legacy interface methods
  getPagesData(): PagesData {
    return {
      pages: {},
      site: this.getSiteData()
    };
  }

  getMenuItems(): MenuItem[] {
    // Return cached menu synchronously
    return this.cachedMenu;
  }

  getPageData(pageKey: string): PageData | null {
    // This is a synchronous method, so we return null
    // The actual page data should be loaded async in the route handler
    return null;
  }

  getSiteData(): SiteData {
    const settings = this.cachedSettings || {};
    return {
      name: settings.siteTitle || 'Santa Maria Bouar',
      domain: settings.siteUrl || 'http://localhost:3002',
      description: settings.siteDescription || '',
      logo: settings.logo || '/images/logo.png',
      favicon: settings.favicon || '/images/favicon.ico',
      social: {
        linkedin: settings.socialMedia?.linkedin || '',
        facebook: settings.socialMedia?.facebook || ''
      }
    };
  }

  /** Cached site settings for layouts (footer contact, etc.). */
  getCachedSettings(): Record<string, any> {
    return this.cachedSettings || {};
  }

  getSeoData(pageKey: string, customData?: Partial<SeoData>): SeoData {
    const settings = this.cachedSettings || {};
    const siteData = this.getSiteData();
    
    return {
      pageTitle: customData?.pageTitle || settings.seo?.defaultTitle || siteData.name,
      pageDescription: customData?.pageDescription || settings.seo?.defaultDescription || siteData.description,
      pageKeywords: customData?.pageKeywords || settings.seo?.defaultKeywords || '',
      pageUrl: customData?.pageUrl || siteData.domain,
      pageImage: customData?.pageImage || settings.siteImage || siteData.logo,
      pageType: customData?.pageType || 'website',
      pageRobots: customData?.pageRobots || 'index, follow'
    };
  }

  getPageKeyFromPath(path: string): string {
    if (path === '/') return 'home';
    // Remove leading slash and trailing slash
    const cleanPath = path.replace(/^\/|\/$/g, '');
    // Replace slashes with dashes
    return cleanPath.replace(/\//g, '-') || 'home';
  }

  // Called from app.ts startServer() so the pool is ready before listen
  async initialize() {
    await this.loadCache();
  }
}

const instance = PagesService.getInstance();

export default instance;
