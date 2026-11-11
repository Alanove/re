import { MenuItem } from '../types';
import { MenuService, MenuItem as AdminMenuItem } from '../../admin/services/menuService';

function convertAdminMenuItem(adminItem: AdminMenuItem & { url?: string }): MenuItem {
  const url = (adminItem as any).url || '#';

  const children = adminItem.children
    ? adminItem.children
        .filter(child => child.active)
        .sort((a, b) => a.sort - b.sort)
        .map(child => convertAdminMenuItem(child as AdminMenuItem & { url?: string }))
    : [];

  return {
    key: adminItem.link || adminItem.id,
    title: adminItem.title,
    url,
    active: adminItem.active,
    children
  };
}

function loadMenuById(menuId: string): MenuItem[] {
  try {
    const menuService = MenuService.getInstance();
    const menu = menuService.getMenuWithFormattedUrls(menuId);
    if (!menu) return [];
    return menu.items
      .filter(item => item.active)
      .sort((a, b) => a.sort - b.sort)
      .map(item => convertAdminMenuItem(item as AdminMenuItem & { url?: string }));
  } catch (error) {
    console.error(`Error loading menu ${menuId}:`, error);
    return [];
  }
}

export function getMenuItems(): MenuItem[] {
  return loadMenuById('main-menu');
}

export function getUtilityMenuItems(): MenuItem[] {
  return loadMenuById('utility-menu');
}

export function getFooterMenuItems(): MenuItem[] {
  return loadMenuById('footer-menu');
}

export function getChildMenuItems(parentSlug: string): MenuItem[] {
  try {
    const menuService = MenuService.getInstance();
    const mainMenu = menuService.getMenuWithFormattedUrls('main-menu');
    if (!mainMenu) return [];
    const parentItem = mainMenu.items.find(item => item.active && item.link === parentSlug);
    if (!parentItem?.children) return [];
    return parentItem.children
      .filter(child => child.active)
      .sort((a, b) => a.sort - b.sort)
      .map(child => convertAdminMenuItem(child as AdminMenuItem & { url?: string }));
  } catch (error) {
    console.error('Error loading child menu items:', error);
    return [];
  }
}
