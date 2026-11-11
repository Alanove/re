import { db } from '../../src/config/database';

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

export class AdminMenuService {
  private static instance: AdminMenuService;

  private constructor() {}

  public static getInstance(): AdminMenuService {
    if (!AdminMenuService.instance) {
      AdminMenuService.instance = new AdminMenuService();
    }
    return AdminMenuService.instance;
  }

  private parseJsonField(value: string | null, defaultValue: any = []): any {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  public async getAllMenuItems(): Promise<AdminMenuItem[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, url,
          parent_id as parentId,
          order_index as \`order\`,
          icon, roles,
          is_visible as isVisible
        FROM admin_menu
        ORDER BY order_index
      `);
      
      const allItems = (rows as any[]).map((row: any) => ({
        ...row,
        text: row.title, // Add text property for view compatibility
        roles: this.parseJsonField(row.roles, []),
        children: []
      }));
      
      // Build hierarchical structure
      const topLevelItems: any[] = [];
      const itemsMap = new Map();
      
      // First pass: create map of all items
      allItems.forEach(item => {
        itemsMap.set(item.id, item);
      });
      
      // Second pass: organize into hierarchy
      allItems.forEach(item => {
        if (item.parentId === null || item.parentId === undefined) {
          topLevelItems.push(item);
        } else {
          const parent = itemsMap.get(item.parentId);
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(item);
          }
        }
      });
      
      return topLevelItems;
    } catch (error) {
      console.error('Error fetching admin menu items:', error);
      return [];
    }
  }

  public async getMenuItemById(id: number): Promise<AdminMenuItem | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, url,
          parent_id as parentId,
          order_index as \`order\`,
          icon, roles,
          is_visible as isVisible
        FROM admin_menu
        WHERE id = ?
      `, [id]);
      
      const results = rows as any[];
      if (results.length === 0) return null;
      
      const item = results[0];
      return {
        ...item,
        roles: this.parseJsonField(item.roles, [])
      };
    } catch (error) {
      console.error('Error fetching admin menu item by ID:', error);
      return null;
    }
  }

  public async createMenuItem(itemData: Omit<AdminMenuItem, 'id'>): Promise<AdminMenuItem> {
    try {
      const [result] = await db.query(`
        INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        itemData.title,
        itemData.url,
        itemData.parentId || null,
        itemData.order,
        itemData.icon || '',
        JSON.stringify(itemData.roles || []),
        itemData.isVisible ? 1 : 0
      ]);
      
      const insertId = (result as any).insertId;
      const item = await this.getMenuItemById(insertId);
      if (!item) throw new Error('Failed to retrieve created menu item');
      return item;
    } catch (error) {
      console.error('Error creating admin menu item:', error);
      throw new Error('Failed to create admin menu item');
    }
  }

  public async updateMenuItem(id: number, updates: Partial<Omit<AdminMenuItem, 'id'>>): Promise<AdminMenuItem | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.url !== undefined) {
        updateFields.push('url = ?');
        values.push(updates.url);
      }
      if (updates.parentId !== undefined) {
        updateFields.push('parent_id = ?');
        values.push(updates.parentId);
      }
      if (updates.order !== undefined) {
        updateFields.push('order_index = ?');
        values.push(updates.order);
      }
      if (updates.icon !== undefined) {
        updateFields.push('icon = ?');
        values.push(updates.icon);
      }
      if (updates.roles !== undefined) {
        updateFields.push('roles = ?');
        values.push(JSON.stringify(updates.roles));
      }
      if (updates.isVisible !== undefined) {
        updateFields.push('is_visible = ?');
        values.push(updates.isVisible ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return await this.getMenuItemById(id);
      }

      values.push(id);
      await db.query(`
        UPDATE admin_menu
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getMenuItemById(id);
    } catch (error) {
      console.error('Error updating admin menu item:', error);
      return null;
    }
  }

  public async deleteMenuItem(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM admin_menu WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting admin menu item:', error);
      return false;
    }
  }

  public async getMenuForUser(userRole: string): Promise<AdminMenuItem[]> {
    try {
      const items = await this.getAllMenuItems();

      const roleAllowed = (item: { isVisible: boolean; roles: string[] }): boolean => {
        if (!item.isVisible) {
          return false;
        }
        // Empty roles: Super Admin only
        if (!item.roles || item.roles.length === 0) {
          return userRole === 'Super Admin';
        }
        return item.roles.includes(userRole);
      };

      return items
        .map((item: any) => {
          const children = Array.isArray(item.children)
            ? item.children.filter((child: any) => roleAllowed(child))
            : [];

          // Show parent if it is allowed, or if it has visible children (folder parents)
          const parentAllowed = roleAllowed(item);
          if (!parentAllowed && children.length === 0) {
            return null;
          }

          return {
            ...item,
            children
          };
        })
        .filter(Boolean) as AdminMenuItem[];
    } catch (error) {
      console.error('Error fetching menu for user:', error);
      return [];
    }
  }

  public setActiveMenu(menu: any[], currentPath: string): any[] {
    return menu.map(item => {
      // Create a shallow copy to avoid mutating the original object
      const newItem = { ...item };
      
      // Check if this item is active
      // Exact match or partial match (starts with) logic
      // For dashboard, we want exact match mostly, or simple check
      let isActive = false;
      
      if (newItem.url === '/admin/dashboard' && currentPath === '/admin/dashboard') {
        isActive = true;
      } else if (newItem.url !== '#' && currentPath.startsWith(newItem.url)) {
        // If url is not just a placeholder and current path starts with it
        isActive = true;
      }
      
      // Process children recursively
      if (newItem.children && newItem.children.length > 0) {
        newItem.children = this.setActiveMenu(newItem.children, currentPath);
        
        // If any child is active, parent should be active (expanded)
        if (newItem.children.some((child: any) => child.active)) {
          isActive = true;
        }
      }
      
      newItem.active = isActive;
      
      return newItem;
    });
  }
}

export const adminMenuService = AdminMenuService.getInstance();
