import { MenuItem } from '../types';
import { MenuService, MenuItem as AdminMenuItem } from '../../admin/services/menuService';

// Convert admin menu items to main website format
function convertAdminMenuItem(adminItem: AdminMenuItem, parentLink?: string): MenuItem {
  // Build URL based on item type and link
  let url = '#';
  
  if (adminItem.type === 'page' && adminItem.link) {
    // Convert link to proper URL format
    if (adminItem.link === 'home') {
      url = '/';
    } else if (adminItem.link.startsWith('http')) {
      url = adminItem.link; // External links
    } else {
      // For submenu items, use parentmenu#key format
      if (parentLink && parentLink !== 'home') {
        url = `/${parentLink}#${adminItem.link}`;
      } else {
        url = `/${adminItem.link}`;
      }
    }
  } else if (adminItem.type === 'external' && adminItem.link) {
    // Handle external links
    if (adminItem.link.startsWith('http')) {
      url = adminItem.link; // Full external URL
    } else {
      url = adminItem.link; // Relative or absolute path
    }
  }

  // Convert children recursively, passing the current item's link as parent
  const children = adminItem.children
    ? adminItem.children
        .filter(child => child.active)
        .sort((a, b) => a.sort - b.sort)
        .map(child => convertAdminMenuItem(child, adminItem.link))
    : [];

  return {
    key: adminItem.link || adminItem.id,
    title: adminItem.title,
    url: url,
    active: adminItem.active,
    children: children
  };
}

export function getMenuItems(): MenuItem[] {
  try {
    const menuService = MenuService.getInstance();
    const mainMenu = menuService.getMenuWithFormattedUrls('main-menu');
    
    if (!mainMenu) {
      console.warn('Main menu not found, returning empty menu');
      return [];
    }

    // Filter active items and convert to main website format
    const activeItems = mainMenu.items
      .filter(item => item.active)
      .sort((a, b) => a.sort - b.sort)
      .map(item => convertAdminMenuItem(item));

    return activeItems;
  } catch (error) {
    console.error('Error loading menu items from admin system:', error);
    return [];
  }
}

export function getChildMenuItems(parentSlug: string): MenuItem[] {
  try {
    const menuService = MenuService.getInstance();
    const mainMenu = menuService.getMenuWithFormattedUrls('main-menu');
    
    if (!mainMenu) {
      return [];
    }

    // Find the parent menu item by link/slug
    const parentItem = mainMenu.items.find(item => 
      item.active && item.link === parentSlug
    );

    if (!parentItem || !parentItem.children) {
      return [];
    }

    // Convert and return active child items
    return parentItem.children
      .filter(child => child.active)
      .sort((a, b) => a.sort - b.sort)
      .map(child => convertAdminMenuItem(child, parentItem.link));
  } catch (error) {
    console.error('Error loading child menu items:', error);
    return [];
  }
} 