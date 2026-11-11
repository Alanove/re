import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

function getPageUrlByKey(pageKey: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATHS.PAGES_FILE, 'utf8'));
    const page = data.pages?.[pageKey];
    return page?.url || null;
  } catch {
    return null;
  }
}

// Menu item interface
export interface MenuItem {
  id: string;
  title: string;
  type: 'page' | 'file' | 'external' | 'anchor' | '';
  link: string;
  sort: number;
  active: boolean;
  children: MenuItem[];
}

// Menu interface
export interface Menu {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
}

// Menu data interface
export interface MenuData {
  menus: Menu[];
}

export class MenuService {
  private static instance: MenuService;
  private dataPath: string;
  private menuData: MenuData;

  private constructor() {
    this.dataPath = DATA_PATHS.MENU_FILE;
    this.menuData = this.loadMenus();
  }

  public static getInstance(): MenuService {
    if (!MenuService.instance) {
      MenuService.instance = new MenuService();
    }
    return MenuService.instance;
  }

  /**
   * Load menus from JSON file
   */
  private loadMenus(): MenuData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading menus:', error);
      return {
        menus: []
      };
    }
  }

  /**
   * Save menus to JSON file
   */
  private saveMenus(): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.menuData, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving menus:', error);
      throw new Error('Failed to save menus');
    }
  }

  /**
   * Reload menus from file
   */
  public reloadMenus(): void {
    this.menuData = this.loadMenus();
  }

  /**
   * Get all menus
   */
  public getAllMenus(): Menu[] {
    return this.menuData.menus;
  }

  /**
   * Get menu by ID
   */
  public getMenuById(id: string): Menu | null {
    return this.menuData.menus.find(menu => menu.id === id) || null;
  }

  /**
   * Format menu item URL based on type and parent
   */
  private formatMenuItemUrl(item: MenuItem, _parentLink?: string): string {
    if (item.type === 'anchor' && item.link) {
      const anchor = item.link.startsWith('#') ? item.link : `#${item.link}`;
      if (anchor === '#sectors' || anchor === '#contact-us' || anchor === '#submit_your_inquiry') {
        return `/${anchor}`;
      }
      return anchor;
    }
    if (item.type === 'page' && item.link) {
      if (item.link === 'home') {
        return '/';
      }
      if (item.link.startsWith('http')) {
        return item.link;
      }
      const pageUrl = getPageUrlByKey(item.link);
      if (pageUrl) {
        return pageUrl;
      }
      return `/${item.link}`;
    }
    if (item.type === 'external' && item.link) {
      return item.link.startsWith('http') ? item.link : item.link;
    }
    return '#';
  }

  /**
   * Get menu with formatted URLs
   */
  public getMenuWithFormattedUrls(id: string): Menu | null {
    const menu = this.getMenuById(id);
    if (!menu) return null;

    const formatMenuItems = (items: MenuItem[], parentLink?: string): MenuItem[] => {
      return items.map(item => ({
        ...item,
        url: this.formatMenuItemUrl(item, parentLink),
        children: item.children ? formatMenuItems(item.children, item.link) : []
      }));
    };

    return {
      ...menu,
      items: formatMenuItems(menu.items)
    };
  }

  /**
   * Create a new menu
   */
  public createMenu(menuData: Omit<Menu, 'id'>): Menu {
    const newMenu: Menu = {
      id: this.generateId(),
      ...menuData
    };

    this.menuData.menus.push(newMenu);
    this.saveMenus();
    return newMenu;
  }

  /**
   * Update menu
   */
  public updateMenu(id: string, updates: Partial<Omit<Menu, 'id'>>): Menu | null {
    const menuIndex = this.menuData.menus.findIndex(menu => menu.id === id);
    if (menuIndex === -1) {
      return null;
    }

    this.menuData.menus[menuIndex] = {
      ...this.menuData.menus[menuIndex],
      ...updates
    };

    this.saveMenus();
    return this.menuData.menus[menuIndex];
  }

  /**
   * Delete menu
   */
  public deleteMenu(id: string): boolean {
    const menuIndex = this.menuData.menus.findIndex(menu => menu.id === id);
    if (menuIndex === -1) {
      return false;
    }

    this.menuData.menus.splice(menuIndex, 1);
    this.saveMenus();
    return true;
  }

  /**
   * Get menu item by ID (recursive search)
   */
  public getMenuItemById(menuId: string, itemId: string): MenuItem | null {
    const menu = this.getMenuById(menuId);
    if (!menu) return null;

    return this.findMenuItemRecursive(menu.items, itemId);
  }

  /**
   * Add menu item to menu
   */
  public addMenuItem(menuId: string, itemData: Omit<MenuItem, 'id' | 'children'>): MenuItem | null {
    const menu = this.getMenuById(menuId);
    if (!menu) return null;

    const newItem: MenuItem = {
      id: this.generateId(),
      ...itemData,
      children: []
    };

    menu.items.push(newItem);
    this.saveMenus();
    return newItem;
  }

  /**
   * Add child menu item
   */
  public addChildMenuItem(menuId: string, parentItemId: string, itemData: Omit<MenuItem, 'id' | 'children'>): MenuItem | null {
    const parentItem = this.getMenuItemById(menuId, parentItemId);
    if (!parentItem) return null;

    const newItem: MenuItem = {
      id: this.generateId(),
      ...itemData,
      children: []
    };

    parentItem.children.push(newItem);
    this.saveMenus();
    return newItem;
  }

  /**
   * Update menu item
   */
  public updateMenuItem(menuId: string, itemId: string, updates: Partial<Omit<MenuItem, 'id' | 'children'>>): MenuItem | null {
    const item = this.getMenuItemById(menuId, itemId);
    if (!item) return null;

    Object.assign(item, updates);
    this.saveMenus();
    return item;
  }

  /**
   * Delete menu item
   */
  public deleteMenuItem(menuId: string, itemId: string): boolean {
    console.log(`MenuService.deleteMenuItem called with menuId=${menuId}, itemId=${itemId}`);
    const menu = this.getMenuById(menuId);
    if (!menu) {
      console.log('Menu not found:', menuId);
      return false;
    }

    console.log('Menu found, attempting recursive deletion');
    const result = this.deleteMenuItemRecursive(menu.items, itemId);
    console.log('Recursive deletion result:', result);
    return result;
  }

  /**
   * Move menu item (drag and drop)
   */
  public moveMenuItem(menuId: string, itemId: string, newSort: number, newParentId?: string): boolean {
    const menu = this.getMenuById(menuId);
    if (!menu) return false;

    const item = this.getMenuItemById(menuId, itemId);
    if (!item) return false;

    // Remove item from current position
    this.removeMenuItemFromParent(menu.items, itemId);

    // Add to new position
    if (newParentId) {
      const newParent = this.getMenuItemById(menuId, newParentId);
      if (newParent) {
        item.sort = newSort;
        newParent.children.push(item);
        this.sortMenuItems(newParent.children);
      }
    } else {
      item.sort = newSort;
      menu.items.push(item);
      this.sortMenuItems(menu.items);
    }

    this.saveMenus();
    return true;
  }

  /**
   * Sort menu items by sort order
   */
  private sortMenuItems(items: MenuItem[]): void {
    items.sort((a, b) => a.sort - b.sort);
    items.forEach(item => {
      if (item.children.length > 0) {
        this.sortMenuItems(item.children);
      }
    });
  }

  /**
   * Find menu item recursively
   */
  private findMenuItemRecursive(items: MenuItem[], itemId: string): MenuItem | null {
    for (const item of items) {
      if (item.id === itemId) {
        return item;
      }
      if (item.children.length > 0) {
        const found = this.findMenuItemRecursive(item.children, itemId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Delete menu item recursively
   */
  private deleteMenuItemRecursive(items: MenuItem[], itemId: string): boolean {
    console.log(`deleteMenuItemRecursive called with ${items.length} items, looking for ${itemId}`);
    for (let i = 0; i < items.length; i++) {
      console.log(`Checking item ${i}: ${items[i].id}`);
      if (items[i].id === itemId) {
        console.log(`Found item to delete: ${items[i].id}`);
        items.splice(i, 1);
        this.saveMenus();
        console.log('Item deleted and menus saved');
        return true;
      }
      if (items[i].children.length > 0) {
        console.log(`Checking children of item ${items[i].id}`);
        const deleted = this.deleteMenuItemRecursive(items[i].children, itemId);
        if (deleted) return true;
      }
    }
    console.log('Item not found in this level');
    return false;
  }

  /**
   * Remove menu item from parent (without saving)
   */
  private removeMenuItemFromParent(items: MenuItem[], itemId: string): boolean {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === itemId) {
        items.splice(i, 1);
        return true;
      }
      if (items[i].children.length > 0) {
        const removed = this.removeMenuItemFromParent(items[i].children, itemId);
        if (removed) return true;
      }
    }
    return false;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return 'menu_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get empty menu item
   */
  public getEmptyMenuItem(): Omit<MenuItem, 'id' | 'children'> {
    return {
      title: '',
      type: 'page',
      link: '',
      sort: 1,
      active: true
    };
  }

  /**
   * Get empty menu
   */
  public getEmptyMenu(): Omit<Menu, 'id'> {
    return {
      name: '',
      description: '',
      items: []
    };
  }

  /**
   * Validate menu data
   */
  public validateMenuData(menuData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!menuData.name || menuData.name.trim() === '') {
      errors.push('Menu name is required');
    }

    if (!menuData.description || menuData.description.trim() === '') {
      errors.push('Menu description is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate menu item data
   */
  public validateMenuItemData(itemData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!itemData.title || itemData.title.trim() === '') {
      errors.push('Menu item title is required');
    }

    // Allow empty type for parent menu items
    if (itemData.type !== '' && !['page', 'file', 'external'].includes(itemData.type)) {
      errors.push('Menu item type must be empty (for parent items), page, file, or external');
    }

    // Link is only required for non-empty types
    if (itemData.type !== '' && (!itemData.link || itemData.link.trim() === '')) {
      errors.push('Menu item link is required for page, file, or external types');
    }

    if (typeof itemData.sort !== 'number' || itemData.sort < 0) {
      errors.push('Menu item sort order must be a positive number');
    }

    if (typeof itemData.active !== 'boolean') {
      errors.push('Menu item active status must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get menu statistics
   */
  public getMenuStatistics(): {
    totalMenus: number;
    totalItems: number;
    menuNames: string[];
  } {
    let totalItems = 0;
    const menuNames: string[] = [];

    this.menuData.menus.forEach(menu => {
      menuNames.push(menu.name);
      totalItems += this.countMenuItems(menu.items);
    });

    return {
      totalMenus: this.menuData.menus.length,
      totalItems,
      menuNames
    };
  }

  /**
   * Count menu items recursively
   */
  private countMenuItems(items: MenuItem[]): number {
    let count = items.length;
    items.forEach(item => {
      count += this.countMenuItems(item.children);
    });
    return count;
  }
} 