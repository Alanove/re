import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { i18nService, SupportedLanguage } from './i18nService';

export interface AdminMenuItem {
  id: number;
  title: string;
  url: string;
  parentId: number | null;
  order: number;
  icon: string;
  roles: string[];
  isVisible: boolean;
}

interface MenuJsonData {
  menu: Array<{
    id: number;
    title: string;
    text?: string;
    url: string;
    parentId: number | null;
    order: number;
    icon: string;
    roles: string[];
    isVisible: boolean;
    children?: any[];
  }>;
}

export class AdminMenuService {
  private static instance: AdminMenuService;

  private constructor() {}

  public static getInstance(): AdminMenuService {
    if (!AdminMenuService.instance) {
      AdminMenuService.instance = new AdminMenuService();
    }
    return AdminMenuService.instance;
  }

  /**
   * Read menu data from JSON file
   */
  private readMenuData(): MenuJsonData {
    try {
      const filePath = DATA_PATHS.ADMIN_MENU_FILE;
      if (!fs.existsSync(filePath)) {
        console.warn('Admin menu JSON file not found:', filePath);
        return { menu: [] };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as MenuJsonData;
    } catch (error) {
      console.error('Error reading admin menu JSON file:', error);
      return { menu: [] };
    }
  }

  /**
   * Write menu data to JSON file
   */
  private writeMenuData(data: MenuJsonData): void {
    try {
      const filePath = DATA_PATHS.ADMIN_MENU_FILE;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing admin menu JSON file:', error);
      throw new Error('Failed to write admin menu data');
    }
  }

  /**
   * Recursively process menu items: translate text and ensure children array exists
   */
  private processMenuItems(items: any[], language: SupportedLanguage): any[] {
    const menuKeyMap: Record<string, string> = {
      'Dashboard': 'menu.dashboard',
      'Pages': 'menu.pages',
      'Tags': 'menu.tags',
      'Homepage content': 'menu.homeContent',
      'Home Page Slider': 'menu.slider',
      'Projects': 'menu.projects',
      'Menus': 'menu.menus',
      'Users': 'menu.users',
      'Site Settings': 'menu.siteSettings',
      'Accounting': 'menu.accounting',
      'Transactions': 'menu.transactions',
      'Payment Parameters': 'menu.payments',
      'Accounts': 'menu.accounts',
      'Transaction Categories': 'menu.transactionCategories',
      'Common Expenses': 'menu.commonExpenses',
      'Products': 'menu.products',
      'Categories': 'menu.categories',
      'Orders': 'menu.orders',
      'Shipments': 'menu.shipments',
      'Discounts': 'menu.discounts',
      'Customers': 'menu.customers',
      'Reports': 'menu.reports',
      'E-commerce Settings': 'menu.e-commercesettings',
      'Catalog': 'menu.catalog',
      'Brands': 'menu.brands',
      'Product Attributes': 'menu.productattributes',
      'Sales': 'menu.sales',
      'Content Management': 'menu.contentmanagement',
      'Settings': 'menu.settings',
      'Email Templates': 'menu.emailTemplates',
      'Contact Settings': 'menu.contactSettings',
      'Security & Email': 'menu.integrationSettings',
      'Live Chat': 'menu.liveChat',
      'Newsletter': 'menu.newsletter',
      'Reviews': 'menu.reviews'
    };
    
    return items.map(item => {
      // Translate menu item title
      const translationKey = menuKeyMap[item.title] || `menu.${item.title.toLowerCase().replace(/\s+/g, '')}`;
      const translatedText = i18nService.translate(translationKey, language) || item.title;
      
      const processedItem: any = {
        ...item,
        text: item.text || translatedText,
        roles: Array.isArray(item.roles) ? item.roles : [],
        children: item.children ? this.processMenuItems(item.children, language) : []
      };
      
      // Sort children by order if they exist
      if (processedItem.children && processedItem.children.length > 0) {
        processedItem.children.sort((a: any, b: any) => a.order - b.order);
      }
      
      return processedItem;
    }).sort((a, b) => a.order - b.order);
  }

  public async getAllMenuItems(language: SupportedLanguage = 'en'): Promise<AdminMenuItem[]> {
    try {
      const menuData = this.readMenuData();
      // Menu is already in nested structure, just process it
      return this.processMenuItems(menuData.menu, language);
    } catch (error) {
      console.error('Error fetching admin menu items:', error);
      return [];
    }
  }

  public async getMenuItemById(id: number): Promise<AdminMenuItem | null> {
    try {
      const menuData = this.readMenuData();
      const item = menuData.menu.find((item: any) => item.id === id);
      
      if (!item) return null;
      
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        parentId: item.parentId,
        order: item.order,
        icon: item.icon,
        roles: Array.isArray(item.roles) ? item.roles : [],
        isVisible: item.isVisible !== false
      };
    } catch (error) {
      console.error('Error fetching admin menu item by ID:', error);
      return null;
    }
  }

  public async createMenuItem(itemData: Omit<AdminMenuItem, 'id'>): Promise<AdminMenuItem> {
    try {
      const menuData = this.readMenuData();
      
      // Find the highest ID and increment
      const maxId = menuData.menu.length > 0 
        ? Math.max(...menuData.menu.map(item => item.id))
        : 0;
      const newId = maxId + 1;
      
      const newItem = {
        id: newId,
        title: itemData.title,
        text: itemData.title,
        url: itemData.url,
        parentId: itemData.parentId || null,
        order: itemData.order,
        icon: itemData.icon || '',
        roles: itemData.roles || [],
        isVisible: itemData.isVisible !== false
      };
      
      menuData.menu.push(newItem);
      this.writeMenuData(menuData);
      
      return {
        id: newId,
        title: itemData.title,
        url: itemData.url,
        parentId: itemData.parentId || null,
        order: itemData.order,
        icon: itemData.icon || '',
        roles: itemData.roles || [],
        isVisible: itemData.isVisible !== false
      };
    } catch (error) {
      console.error('Error creating admin menu item:', error);
      throw new Error('Failed to create admin menu item');
    }
  }

  public async updateMenuItem(id: number, updates: Partial<Omit<AdminMenuItem, 'id'>>): Promise<AdminMenuItem | null> {
    try {
      const menuData = this.readMenuData();
      const itemIndex = menuData.menu.findIndex((item: any) => item.id === id);
      
      if (itemIndex === -1) return null;
      
      // Update the item
      const item = menuData.menu[itemIndex];
      if (updates.title !== undefined) {
        item.title = updates.title;
        item.text = updates.title;
      }
      if (updates.url !== undefined) item.url = updates.url;
      if (updates.parentId !== undefined) item.parentId = updates.parentId;
      if (updates.order !== undefined) item.order = updates.order;
      if (updates.icon !== undefined) item.icon = updates.icon;
      if (updates.roles !== undefined) item.roles = updates.roles;
      if (updates.isVisible !== undefined) item.isVisible = updates.isVisible;
      
      this.writeMenuData(menuData);
      
      return await this.getMenuItemById(id);
    } catch (error) {
      console.error('Error updating admin menu item:', error);
      return null;
    }
  }

  public async deleteMenuItem(id: number): Promise<boolean> {
    try {
      const menuData = this.readMenuData();
      const initialLength = menuData.menu.length;
      
      // Remove the item and any children
      menuData.menu = menuData.menu.filter((item: any) => {
        return item.id !== id && item.parentId !== id;
      });
      
      this.writeMenuData(menuData);
      
      return menuData.menu.length < initialLength;
    } catch (error) {
      console.error('Error deleting admin menu item:', error);
      return false;
    }
  }

  public async getMenuForUser(userRole: string, language: SupportedLanguage = 'en'): Promise<AdminMenuItem[]> {
    try {
      const items = await this.getAllMenuItems(language);
      return items.filter(item => 
        item.isVisible && 
        (item.roles.length === 0 || item.roles.includes(userRole))
      );
    } catch (error) {
      console.error('Error fetching menu for user:', error);
      return [];
    }
  }

  /**
   * Check if a menu item URL matches the current URL
   */
  private urlMatches(itemUrl: string | null, currentUrl: string): boolean {
    if (!currentUrl || !itemUrl || itemUrl === '#' || itemUrl === 'javascript:;') {
      return false;
    }
    
    const normalizeUrl = (url: string): string => {
      return url.replace(/\/+$/, '') || '/';
    };
    
    const normalizedCurrent = normalizeUrl(currentUrl);
    const normalizedItemUrl = normalizeUrl(itemUrl);
    
    // Exact match
    if (normalizedCurrent === normalizedItemUrl) {
      return true;
    }
    
    // Check if current URL starts with item URL (for nested routes like /admin/products/edit/123)
    if (normalizedItemUrl !== '/' && normalizedCurrent.startsWith(normalizedItemUrl + '/')) {
      return true;
    }
    
    return false;
  }

  /**
   * Recursively check if a menu item or any of its children (at any depth) matches the current URL
   */
  private isCurrent(item: any, currentUrl: string): boolean {
    if (!currentUrl) return false;
    
    // Check if current item's URL matches
    if (item.url && this.urlMatches(item.url, currentUrl)) {
      return true;
    }
    
    // Recursively check all children and grandchildren (all levels deep)
    if (item.children && item.children.length > 0) {
      for (const child of item.children) {
        if (this.isCurrent(child, currentUrl)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get menu items with current property set based on URL
   * Recursively processes all levels of children
   */
  public async getMenuWithCurrent(currentUrl: string, language: SupportedLanguage = 'en'): Promise<any[]> {
    const menu = await this.getAllMenuItems(language);
    
    // Recursively set current property on all items (process children first, then parent)
    const setCurrent = (items: any[]): void => {
      items.forEach(item => {
        // First, recursively process all children (depth-first)
        if (item.children && item.children.length > 0) {
          setCurrent(item.children);
        }
        
        // Then check if this item is current:
        // 1. Check if item's own URL matches
        // 2. Check if any child (at any depth) is current
        const itemUrlMatches = item.url && this.urlMatches(item.url, currentUrl);
        const hasCurrentChild = item.children && item.children.some((child: any) => child.current === true);
        
        item.current = itemUrlMatches || hasCurrentChild || false;
      });
    };
    
    setCurrent(menu);
    return menu;
  }

  /**
   * Get menu items (alias for getAllMenuItems for backward compatibility)
   */
  public async getMenu(language: SupportedLanguage = 'en'): Promise<AdminMenuItem[]> {
    return await this.getAllMenuItems(language);
  }
}

export const adminMenuService = AdminMenuService.getInstance();
