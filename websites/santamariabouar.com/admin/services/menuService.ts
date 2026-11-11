import { db } from '../../src/config/database';

// Menu item interface
export interface MenuItem {
  id: string;
  title: string;
  type: 'page' | 'file' | 'external' | '';
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

export class MenuService {
  private static instance: MenuService;

  private constructor() {}

  public static getInstance(): MenuService {
    if (!MenuService.instance) {
      MenuService.instance = new MenuService();
    }
    return MenuService.instance;
  }

  public reloadMenus(): void {
    // Cache clearing - not needed for SQL version
  }

  public async getAllMenus(): Promise<Menu[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title as name,
          '' as description
        FROM menu
        WHERE parent_id IS NULL
        ORDER BY order_index
      `);
      
      const menus = (rows as any[]).map((row: any) => ({
        ...row,
        items: []
      }));
      
      // Load items for each menu
      for (const menu of menus) {
        menu.items = await this.getMenuItems(menu.id);
      }
      
      return menus;
    } catch (error) {
      console.error('Error fetching menus:', error);
      return [];
    }
  }

  public async getMenuById(id: string): Promise<Menu | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title as name,
          '' as description
        FROM menu
        WHERE id = ?
      `, [id]);
      
      const results = rows as any[];
      if (results.length === 0) return null;
      
      const menu = {
        ...results[0],
        items: await this.getMenuItems(id)
      };
      
      return menu;
    } catch (error) {
      console.error('Error fetching menu by ID:', error);
      return null;
    }
  }

  public async createMenu(menuData: Omit<Menu, 'id'>): Promise<Menu> {
    try {
      console.log('MenuService.createMenu called with:', menuData);
      
      const [result] = await db.query(
        'INSERT INTO menu (title, parent_id, order_index, url, is_visible) VALUES (?, NULL, 0, "", 1)',
        [menuData.name]
      );
      
      console.log('Insert result:', result);
      const newId = (result as any).insertId.toString();
      console.log('New menu ID:', newId);
      
      return {
        id: newId,
        name: menuData.name,
        description: menuData.description,
        items: []
      };
    } catch (error) {
      console.error('Error creating menu in service:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw new Error('Failed to create menu: ' + (error as Error).message);
    }
  }

  public async updateMenu(id: string, updates: Partial<Menu>): Promise<Menu | null> {
    try {
      if (updates.name) {
        await db.query(
          'UPDATE menu SET title = ? WHERE id = ?',
          [updates.name, id]
        );
      }
      
      return await this.getMenuById(id);
    } catch (error) {
      console.error('Error updating menu:', error);
      return null;
    }
  }

  public async deleteMenu(id: string): Promise<boolean> {
    try {
      console.log('MenuService.deleteMenu called with ID:', id);
      
      // Recursively delete all child menu items first
      console.log('Deleting child menu items recursively...');
      await this.deleteMenuItemsRecursively(id);
      
      // Then delete the menu itself
      console.log('Deleting menu record itself...');
      const [result] = await db.query(
        'DELETE FROM menu WHERE id = ?',
        [id]
      );
      
      const affectedRows = (result as any).affectedRows;
      console.log('Delete affected rows:', affectedRows);
      
      return affectedRows > 0;
    } catch (error) {
      console.error('Error deleting menu (detailed):', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error; // Re-throw to let the controller handle it
    }
  }

  private async deleteMenuItemsRecursively(parentId: string): Promise<void> {
    try {
      console.log('deleteMenuItemsRecursively called for parent ID:', parentId);
      
      // Get all direct children of this menu item
      const [children] = await db.query(
        'SELECT id FROM menu WHERE parent_id = ?',
        [parentId]
      );
      
      const childrenArray = children as any[];
      console.log('Found', childrenArray.length, 'children for parent', parentId);
      
      // Recursively delete each child's descendants
      for (const child of childrenArray) {
        console.log('Recursively deleting child:', child.id);
        await this.deleteMenuItemsRecursively(child.id.toString());
      }
      
      // Delete all direct children
      console.log('Deleting direct children of:', parentId);
      const [result] = await db.query(
        'DELETE FROM menu WHERE parent_id = ?',
        [parentId]
      );
      console.log('Deleted', (result as any).affectedRows, 'direct children');
    } catch (error) {
      console.error('Error deleting menu items recursively for parent', parentId, ':', error);
      throw error;
    }
  }

  private async getMenuItems(menuId: string): Promise<MenuItem[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title,
          url as link,
          order_index as sort,
          is_visible as active,
          COALESCE(css_class, '') as type
        FROM menu
        WHERE parent_id = ?
        ORDER BY order_index
      `, [menuId]);
      
      const items: MenuItem[] = (rows as any[]).map((row: any) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        link: row.link || '',
        sort: row.sort,
        active: Boolean(row.active),
        children: []
      }));
      
      // Recursively load children for each item
      for (const item of items) {
        item.children = await this.getMenuItems(item.id);
      }
      
      return items;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return [];
    }
  }

  public async deleteMenuItem(menuId: string, itemId: string): Promise<boolean> {
    try {
      console.log('Deleting menu item:', itemId, 'from menu:', menuId);
      
      // First, recursively delete all child menu items
      await this.deleteMenuItemsRecursively(itemId);
      
      // Then delete the menu item itself
      const [result] = await db.query(
        'DELETE FROM menu WHERE id = ?',
        [itemId]
      );
      
      const affectedRows = (result as any).affectedRows;
      console.log('Delete affected rows:', affectedRows);
      
      return affectedRows > 0;
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return false;
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  public validateMenuData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.name || data.name.trim() === '') {
      errors.push('Menu name is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public validateMenuItemData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.title || data.title.trim() === '') {
      errors.push('Menu item title is required');
    }
    
    if (!data.type) {
      errors.push('Menu item type is required');
    }
    
    if (!data.link || data.link.trim() === '') {
      errors.push('Menu item link is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public async addMenuItem(menuId: string, itemData: Omit<MenuItem, 'id' | 'children'>): Promise<MenuItem | null> {
    try {
      console.log('Adding menu item to menu:', menuId, 'with data:', itemData);
      
      // Get the next sort order for this menu
      const [sortResult] = await db.query(
        'SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ? OR (parent_id IS NULL AND id = ?)',
        [menuId, menuId]
      );
      const maxSort = (sortResult as any[])[0]?.max_sort || 0;
      const nextSort = maxSort + 1;
      
      // Insert the menu item
      const [result] = await db.query(
        'INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)',
        [itemData.title, menuId, nextSort, itemData.link, itemData.active ? 1 : 0, itemData.type]
      );
      
      const newId = (result as any).insertId.toString();
      console.log('Menu item added with ID:', newId);
      
      return {
        id: newId,
        ...itemData,
        children: []
      };
    } catch (error) {
      console.error('Error adding menu item:', error);
      return null;
    }
  }

  public async addChildMenuItem(menuId: string, parentId: string, itemData: Omit<MenuItem, 'id' | 'children'>): Promise<MenuItem | null> {
    try {
      console.log('Adding child menu item to parent:', parentId, 'with data:', itemData);
      
      // Get the next sort order for this parent
      const [sortResult] = await db.query(
        'SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ?',
        [parentId]
      );
      const maxSort = (sortResult as any[])[0]?.max_sort || 0;
      const nextSort = maxSort + 1;
      
      // Insert the child menu item
      const [result] = await db.query(
        'INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)',
        [itemData.title, parentId, nextSort, itemData.link, itemData.active ? 1 : 0, itemData.type]
      );
      
      const newId = (result as any).insertId.toString();
      console.log('Child menu item added with ID:', newId);
      
      return {
        id: newId,
        ...itemData,
        children: []
      };
    } catch (error) {
      console.error('Error adding child menu item:', error);
      return null;
    }
  }
}

export const menuService = MenuService.getInstance();


