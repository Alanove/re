import { db } from '../../src/config/database';
import * as path from 'path';
import * as fs from 'fs';

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
      
      // Get all direct children of this menu item (including type and link for file deletion)
      const [children] = await db.query(
        'SELECT id, css_class as type, url as link FROM menu WHERE parent_id = ?',
        [parentId]
      );
      
      const childrenArray = children as any[];
      console.log('Found', childrenArray.length, 'children for parent', parentId);
      
      // Delete files for child items that are file type
      for (const child of childrenArray) {
        if (child.type === 'file' && child.link) {
          await this.deleteMenuItemFile(child.link);
        }
        // Recursively delete each child's descendants
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
        // Divide by 10 for display (database stores multiples of 10), with backward compatibility
        sort: Math.max(1, Math.round(row.sort / 10)),
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
      
      // Get the menu item to check if it has a file
      const menu = await this.getMenuById(menuId);
      if (menu) {
        const findItem = (items: MenuItem[]): MenuItem | null => {
          for (const item of items) {
            if (item.id === itemId) return item;
            if (item.children && item.children.length > 0) {
              const found = findItem(item.children);
              if (found) return found;
            }
          }
          return null;
        };
        
        const itemToDelete = findItem(menu.items);
        
        // Delete associated file if it's a file type item
        if (itemToDelete && itemToDelete.type === 'file' && itemToDelete.link) {
          await this.deleteMenuItemFile(itemToDelete.link);
        }
      }
      
      // First, recursively delete all child menu items (this will also delete their files)
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

  /**
   * Update menu items that reference a page when the page key/slug changes
   */
  public async updateMenuItemsForPageKey(oldKey: string, newKey: string): Promise<number> {
    try {
      if (!oldKey || !newKey || oldKey === newKey) {
        return 0;
      }

      // Normalize keys - remove leading slash if present
      const normalizedOldKey = oldKey.startsWith('/') ? oldKey.substring(1) : oldKey;
      const normalizedNewKey = newKey.startsWith('/') ? newKey.substring(1) : newKey;

      console.log(`Updating menu items: searching for page key "${normalizedOldKey}" to update to "${normalizedNewKey}"`);

      // First, let's check what menu items exist with the old key
      const [checkResult] = await db.query(
        `SELECT id, title, url, css_class FROM menu 
         WHERE css_class = 'page' 
         AND (url = ? OR url = ?)`,
        [normalizedOldKey, oldKey]
      ) as any[];

      console.log(`Found ${checkResult.length} menu item(s) with old key:`, checkResult.map((item: any) => ({ id: item.id, title: item.title, url: item.url })));

      // Update menu items that reference the old page key
      // Menu items store the page key in the url field when type is 'page'
      // Handle both with and without leading slash
      const [result] = await db.query(
        `UPDATE menu 
         SET url = ? 
         WHERE css_class = 'page' 
         AND (url = ? OR url = ?)`,
        [normalizedNewKey, normalizedOldKey, oldKey]
      );

      const affectedRows = (result as any).affectedRows || 0;
      console.log(`Updated ${affectedRows} menu item(s) from page key "${normalizedOldKey}" to "${normalizedNewKey}"`);
      
      return affectedRows;
    } catch (error) {
      console.error('Error updating menu items for page key:', error);
      return 0;
    }
  }

  /**
   * Delete a menu item file from the filesystem
   */
  private async deleteMenuItemFile(filePath: string): Promise<void> {
    try {
      // Extract filename from path (e.g., /menu/files/123-abc.pdf -> 123-abc.pdf)
      const fileName = filePath.split('/').pop();
      if (!fileName) return;
      
      const fileSystemPath = path.join(process.cwd(), 'public', 'menu', 'files', fileName);
      
      if (fs.existsSync(fileSystemPath)) {
        fs.unlinkSync(fileSystemPath);
        console.log('Deleted menu item file:', fileSystemPath);
      }
    } catch (error) {
      console.error('Error deleting menu item file:', error);
      // Don't throw - file deletion failure shouldn't prevent menu item deletion
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
    
    if (data.type === undefined || data.type === null) {
      errors.push('Menu item type is required');
    }
    
    // Link is only required for non-parent items (page, file, external)
    // Parent items (type === '') don't need a link
    if (data.type && data.type !== '' && (!data.link || data.link.trim() === '')) {
      errors.push('Menu item link is required for this type');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public async addMenuItem(menuId: string, itemData: Omit<MenuItem, 'id' | 'children'>): Promise<MenuItem | null> {
    try {
      console.log('Adding menu item to menu:', menuId, 'with data:', itemData);
      
      // Use provided sort value (multiplied by 10), or calculate next sort order
      let sortOrder: number;
      if (itemData.sort !== undefined && itemData.sort !== null) {
        // Use provided sort value, multiply by 10 to allow room for insertion
        sortOrder = itemData.sort * 10;
      } else {
        // Get the next sort order for this menu (multiply by 10 to allow room for insertion)
        const [sortResult] = await db.query(
          'SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ? OR (parent_id IS NULL AND id = ?)',
          [menuId, menuId]
        );
        const maxSort = (sortResult as any[])[0]?.max_sort || 0;
        // Calculate next sort order as next multiple of 10
        sortOrder = Math.floor(maxSort / 10) * 10 + 10;
      }
      
      // Insert the menu item
      const [result] = await db.query(
        'INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)',
        [itemData.title, menuId, sortOrder, itemData.link, itemData.active ? 1 : 0, itemData.type]
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
      
      // Use provided sort value (multiplied by 10), or calculate next sort order
      let sortOrder: number;
      if (itemData.sort !== undefined && itemData.sort !== null) {
        // Use provided sort value, multiply by 10 to allow room for insertion
        sortOrder = itemData.sort * 10;
      } else {
        // Get the next sort order for this parent (multiply by 10 to allow room for insertion)
        const [sortResult] = await db.query(
          'SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ?',
          [parentId]
        );
        const maxSort = (sortResult as any[])[0]?.max_sort || 0;
        // Calculate next sort order as next multiple of 10
        sortOrder = Math.floor(maxSort / 10) * 10 + 10;
      }
      
      // Insert the child menu item
      const [result] = await db.query(
        'INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)',
        [itemData.title, parentId, sortOrder, itemData.link, itemData.active ? 1 : 0, itemData.type]
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

  public async updateMenuItem(menuId: string, itemId: string, updates: Partial<Omit<MenuItem, 'id' | 'children'>>): Promise<MenuItem | null> {
    try {
      console.log('Updating menu item:', itemId, 'in menu:', menuId, 'with updates:', updates);
      
      // Build update query dynamically based on what fields are provided
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      
      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(updates.title.trim());
      }
      
      if (updates.type !== undefined) {
        updateFields.push('css_class = ?');
        updateValues.push(updates.type);
      }
      
      if (updates.link !== undefined) {
        updateFields.push('url = ?');
        updateValues.push(updates.link.trim());
      }
      
      if (updates.sort !== undefined) {
        updateFields.push('order_index = ?');
        // Multiply by 10 to allow room for insertion between items
        updateValues.push(updates.sort * 10);
      }
      
      if (updates.active !== undefined) {
        updateFields.push('is_visible = ?');
        updateValues.push(updates.active ? 1 : 0);
      }
      
      if (updateFields.length === 0) {
        console.log('No fields to update');
        // Return the existing item
        const menu = await this.getMenuById(menuId);
        if (menu) {
          const findItem = (items: MenuItem[]): MenuItem | null => {
            for (const item of items) {
              if (item.id === itemId) return item;
              if (item.children && item.children.length > 0) {
                const found = findItem(item.children);
                if (found) return found;
              }
            }
            return null;
          };
          return findItem(menu.items);
        }
        return null;
      }
      
      // Add itemId to the values array for the WHERE clause
      updateValues.push(itemId);
      
      // Execute the update
      const query = `UPDATE menu SET ${updateFields.join(', ')} WHERE id = ?`;
      await db.query(query, updateValues);
      
      console.log('Menu item updated successfully');
      
      // Return the updated item by fetching it from the menu
      const menu = await this.getMenuById(menuId);
      if (menu) {
        const findItem = (items: MenuItem[]): MenuItem | null => {
          for (const item of items) {
            if (item.id === itemId) return item;
            if (item.children && item.children.length > 0) {
              const found = findItem(item.children);
              if (found) return found;
            }
          }
          return null;
        };
        return findItem(menu.items);
      }
      
      return null;
    } catch (error) {
      console.error('Error updating menu item:', error);
      return null;
    }
  }

  public async moveMenuItem(menuId: string, itemId: string, newSort: number, newParentId: string | null): Promise<boolean> {
    try {
      console.log('Moving menu item:', itemId, 'to sort:', newSort, 'parent:', newParentId);
      
      // Get current item info
      const [currentItemRows] = await db.query(
        'SELECT id, parent_id, order_index FROM menu WHERE id = ?',
        [itemId]
      );
      
      const currentItem = (currentItemRows as any[])[0];
      if (!currentItem) {
        console.error('Menu item not found:', itemId);
        return false;
      }
      
      const oldParentId = currentItem.parent_id;
      
      // Convert newParentId: if null, it means top-level, so use menuId; otherwise parse it
      const newParentIdNum = newParentId ? parseInt(newParentId) : parseInt(menuId);
      
      // Multiply newSort by 10 to allow room for insertion between items
      const newSortMultiplied = newSort * 10;
      
      // Use transaction for atomic updates
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        
        // Get all items in the target parent first (before moving, if parent is changing)
        let targetParentForQuery = newParentIdNum;
        if (oldParentId !== newParentIdNum) {
          // Query the target parent (where item will be moved to)
          targetParentForQuery = newParentIdNum;
        } else {
          // Same parent, use current parent
          targetParentForQuery = oldParentId;
        }
        
        const [allItemsRows] = await connection.query(
          'SELECT id, order_index FROM menu WHERE parent_id = ? ORDER BY order_index',
          [targetParentForQuery]
        );
        
        const allItems = allItemsRows as any[];
        
        // Find the moved item and remove it from its current position
        const itemsWithoutMoved = allItems.filter(item => parseInt(item.id) !== parseInt(itemId));
        
        // If parent is changing, update the moved item's parent
        if (oldParentId !== newParentIdNum) {
          await connection.query(
            'UPDATE menu SET parent_id = ? WHERE id = ?',
            [newParentIdNum, itemId]
          );
        }
        
        // Insert the moved item at the new position
        const newOrderedItems = [];
        let currentSort = 10;
        
        for (let i = 0; i < itemsWithoutMoved.length; i++) {
          if (i === newSort - 1) {
            // Insert the moved item here
            newOrderedItems.push({ id: itemId, order_index: currentSort });
            currentSort += 10;
          }
          newOrderedItems.push({ id: itemsWithoutMoved[i].id, order_index: currentSort });
          currentSort += 10;
        }
        
        // If the new position is at the end
        if (newSort > itemsWithoutMoved.length) {
          newOrderedItems.push({ id: itemId, order_index: currentSort });
        }
        
        // Update all sort orders
        for (const item of newOrderedItems) {
          await connection.query(
            'UPDATE menu SET order_index = ? WHERE id = ?',
            [item.order_index, item.id]
          );
        }
        
        await connection.commit();
        console.log('Menu item moved successfully');
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error moving menu item:', error);
      return false;
    }
  }
}

export const menuService = MenuService.getInstance();


