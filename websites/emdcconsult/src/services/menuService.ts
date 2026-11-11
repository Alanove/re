import { MenuItem } from '../types';
import { MenuService, MenuItem as AdminMenuItem } from '../../admin/services/menuService';

/**
 * When the menu "link" for a parent is renamed in the admin, `/about` still uses
 * page slug `about` but `item.link === 'about'` no longer matches. Resolve the
 * parent by a stable set of child page links that identify that submenu.
 */
const PARENT_FALLBACK_SIGNATURES: Record<string, string[]> = {
  about: ['who-we-are', 'past-and-present'],
  insights: ['our-soft-skills', 'news'],
};

function findParentMenuItemByChildSignature(
  items: AdminMenuItem[],
  parentSlug: string
): AdminMenuItem | undefined {
  const signature = PARENT_FALLBACK_SIGNATURES[parentSlug];
  if (!signature?.length) {
    return undefined;
  }
  return items.find((item) => {
    if (!item.active || !item.children?.length) {
      return false;
    }
    const childLinks = item.children.filter((c) => c.active).map((c) => c.link);
    return signature.every((sig) => childLinks.includes(sig));
  });
}

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

    // Find the parent menu item by link/slug (must match pages.json key / URL segment)
    let parentItem = mainMenu.items.find(
      (item) => item.active && item.link === parentSlug
    );

    // If the admin renamed the menu link but the page URL/key stayed the same (e.g. about)
    if (!parentItem) {
      parentItem = findParentMenuItemByChildSignature(mainMenu.items, parentSlug);
    }

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