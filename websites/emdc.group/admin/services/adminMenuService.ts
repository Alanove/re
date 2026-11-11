import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

// Admin menu item interface
export interface AdminMenuItem {
  id: string;
  text: string;
  icon: string;
  url: string;
  active?: boolean;
}

// Admin menu interface
export interface AdminMenu {
  menu: AdminMenuItem[];
}

export class AdminMenuService {
  private static instance: AdminMenuService;
  private menuData!: AdminMenu;

  private constructor() {}

  public static getInstance(): AdminMenuService {
    if (!AdminMenuService.instance) {
      AdminMenuService.instance = new AdminMenuService();
    }
    return AdminMenuService.instance;
  }

  /**
   * Load admin menu from JSON file
   */
  public loadAdminMenu(): AdminMenu {
    if (this.menuData) {
      return this.menuData;
    }

    try {
      const menuPath = DATA_PATHS.ADMIN_MENU_FILE;
      const menuContent = fs.readFileSync(menuPath, 'utf8');
      this.menuData = JSON.parse(menuContent);
      return this.menuData;
    } catch (error) {
      console.error('Error loading admin menu:', error);
      // Return default menu if file not found
      const defaultMenu: AdminMenu = {
        menu: [
          {
            id: 'dashboard',
            text: 'Dashboard',
            icon: 'fa fa-laptop',
            url: '/admin/dashboard',
            active: true
          }
        ]
      };
      this.menuData = defaultMenu;
      return defaultMenu;
    }
  }

  /**
   * Get menu items
   */
  public getMenuItems(): AdminMenuItem[] {
    const menu = this.loadAdminMenu();
    return menu.menu;
  }

  /**
   * Set active menu item by URL
   */
  public setActiveMenuItem(currentUrl: string): void {
    const menu = this.loadAdminMenu();
    menu.menu.forEach(item => {
      item.active = item.url === currentUrl;
    });
  }

  /**
   * Get active menu item
   */
  public getActiveMenuItem(): AdminMenuItem | null {
    const menu = this.loadAdminMenu();
    return menu.menu.find(item => item.active) || null;
  }
}
