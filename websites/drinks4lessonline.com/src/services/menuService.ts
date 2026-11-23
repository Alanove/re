// Public-facing menu service - delegates to admin service
import { MenuService as AdminMenuService, Menu } from '../../admin/services/menuService';

const adminMenuService = AdminMenuService.getInstance();

export class MenuService {
  private static instance: MenuService;

  public static getInstance(): MenuService {
    if (!MenuService.instance) {
      MenuService.instance = new MenuService();
    }
    return MenuService.instance;
  }

  async getAllMenus(): Promise<Menu[]> {
    return await adminMenuService.getAllMenus();
  }

  async getMenuById(id: string): Promise<Menu | null> {
    return await adminMenuService.getMenuById(id);
  }

  reloadMenus(): void {
    adminMenuService.reloadMenus();
  }
}

export const menuService = MenuService.getInstance();
