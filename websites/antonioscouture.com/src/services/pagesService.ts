// Public-facing pages service - delegates to admin service
import { PagesService as AdminPagesService, Page } from '../../admin/services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { MenuService } from '../../admin/services/menuService';
import { MenuItem, SiteData, SeoData, PageData, PagesData } from '../types';
import { STOREFRONT_MAIN_MENU } from '../constants/storefront-nav-menus';
import categoryService from './categoryService';
import type { Category } from './categoryService';
import { sortCollectionsBySeason } from '../utils/fashionLineHelpers';

const adminPagesService = AdminPagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const menuService = MenuService.getInstance();

export class PagesService {
  private static instance: PagesService;
  private cachedSettings: any = null;
  private cachedMenus: Map<string, MenuItem[]> = new Map();
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
      const allCategories = await categoryService.getAllCategories(false);

      this.cachedMenus.clear();

      // Process all menus
      for (const menu of menus) {
        if (menu.items && menu.items.length > 0) {
          const convertedItems = await this.convertMenuItems(menu.items, allCategories);
          this.cachedMenus.set(menu.name, convertedItems);
        }
      }
      this.cacheTime = now;
    }
  }

  private attachCategoryNavFromUrl(converted: MenuItem, allCategories: Category[]): void {
    const raw = (converted.url || '').replace(/\/$/, '');
    const m = raw.match(/^\/shop\/category\/([^/?#]+)$/);
    if (!m?.[1]) return;
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* keep raw slug */
    }
    const cat = allCategories.find((c) => c.slug === slug && c.is_active);
    if (!cat) return;
    converted.isCategory = true;
    converted.category = this.toMenuCategory(cat);

    const subcategories = allCategories.filter((c) => c.parent_id === cat.id && c.is_active);
    if (subcategories.length > 0) {
      converted.children = sortCollectionsBySeason(subcategories).map((child) => ({
        key: `shop-category-${child.slug}`,
        title: child.name,
        url: `/shop/category/${child.slug}`,
        active: true,
        isCategory: true,
        category: this.toMenuCategory(child),
        children: [],
      }));
    }
  }

  private toMenuCategory(cat: Category): NonNullable<MenuItem['category']> {
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url ?? null,
      thumb_url: cat.thumb_url ?? null,
      parent_id: cat.parent_id,
      is_active: cat.is_active,
      is_featured: cat.is_featured,
      order_index: cat.order_index,
    };
  }

  private async convertMenuItems(items: any[], allCategories: Category[]): Promise<MenuItem[]> {
    return await Promise.all(items.map(async (item) => {
      // Generate URL from link
      let url = item.link ? (item.link.startsWith('/') ? item.link : `/${item.link}`) : `/${item.id}`;
      // Generate key from URL path (remove leading slash, replace slashes with dashes)
      const key = url.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
      
      // If menu item type is 'page', fetch the page and use its title
      let displayTitle = item.title;
      if (item.type === 'page' && item.link && item.link.trim() !== '') {
        try {
          // Remove leading slash from link to get slug
          const slug = item.link.replace(/^\/|\/$/g, '').trim();
          // Skip home page lookup (home page may not exist in pages table)
          if (slug && slug !== 'home') {
            const page = await adminPagesService.getPageBySlug(slug);
            if (page && page.title) {
              displayTitle = page.title;
            }
          }
        } catch (error) {
          console.error(`Error fetching page title for slug "${item.link}":`, error);
          // Fall back to menu item title if page fetch fails
        }
      }

      const children = item.children ? await this.convertMenuItems(item.children, allCategories) : [];

      const converted: MenuItem = {
        key: key,
        title: displayTitle,
        url: url,
        id: item.id,
        active: item.active,
        children,
      };

      this.attachCategoryNavFromUrl(converted, allCategories);

      return converted;
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
    return this.getMenu(STOREFRONT_MAIN_MENU);
  }

  getMenu(name: string): MenuItem[] {
    return this.cachedMenus.get(name) || [];
  }

  getPageData(pageKey: string): PageData | null {
    // This is a synchronous method, so we return null
    // The actual page data should be loaded async in the route handler
    return null;
  }

  getSiteData(): SiteData {
    const settings = this.cachedSettings || {};
    return {
      name: settings.siteTitle || '',
      domain: settings.siteUrl || '',
      description: settings.siteDescription || '',
      logo: settings.logo || '/images/logo.png',
      favicon: settings.favicon || '/images/favicon.ico',
      email: settings.contactEmail || '',
      phone: settings.contactPhone || '',
      whatsapp: settings.contactWhatsapp || '',
      address: settings.address || '',
      contactLocations: Array.isArray(settings.contactLocations) ? settings.contactLocations : [],
      social: {
        linkedin: settings.socialMedia?.linkedin || '',
        facebook: settings.socialMedia?.facebook || ''
      }
    };
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

  // Initialize cache on module load
  async initialize() {
    await this.loadCache();
  }

  // Reload cache (force refresh)
  async reloadCache() {
    this.cachedSettings = null;
    this.cacheTime = 0;
    await this.loadCache();
  }
}

const instance = PagesService.getInstance();
// Initialize cache asynchronously (don't wait for it)


export default instance;
