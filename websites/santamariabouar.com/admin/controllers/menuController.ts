import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import { AdminMenuService } from '../services/adminMenuService';
import { MenuService } from '../services/menuService';
import { PagesService } from '../services/pagesService';
import { SiteSettingsService } from '../services/siteSettingsService';

const adminMenuService = AdminMenuService.getInstance();
const menuService = MenuService.getInstance();
const pagesService = PagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class MenuController {
  /**
   * Render menu management page
   */
  public static async menus(req: Request, res: Response): Promise<void> {
    try {
      // Get all menus
      const menus = await menuService.getAllMenus();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Calculate menu statistics
      const totalMenus = menus.length;
      const totalItems = menus.reduce((sum, menu) => sum + (menu.items?.length || 0), 0);
      const statistics = {
        totalMenus,
        totalItems
      };

      res.render('menus/menus', {
        title: 'Menu Management',
        pageTitle: 'Menu Management',
        pageSubtitle: 'Manage your website navigation menus',
        menus: menus,
        statistics: statistics,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering menus:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create menu form
   */
  public static async createMenu(req: Request, res: Response): Promise<void> {
    try {
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Create empty menu object for the form
      const emptyMenu = {
        id: '',
        name: '',
        description: '',
        items: []
      };

      res.render('menus/create-menu', {
        title: 'Create Menu',
        pageTitle: 'Create New Menu',
        pageSubtitle: 'Add a new navigation menu',
        menu: emptyMenu,
        siteTitle: siteTitle
      });
    } catch (error) {
      console.error('Error rendering create menu:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create menu form submission
   */
  public static async createMenuPost(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      console.log('Creating menu with:', { name, description });

      // Validate required fields
      if (!name || !name.trim()) {
        console.log('Validation failed: Name is required');
        res.redirect('/admin/menus/create?error=' + encodeURIComponent('Menu name is required'));
        return;
      }

      // Create menu
      console.log('Calling menuService.createMenu...');
      const newMenu = await menuService.createMenu({ name, description, items: [] });
      console.log('Menu created successfully:', newMenu);

      res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${newMenu.name}" created successfully`));
    } catch (error) {
      console.error('Error creating menu:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      res.redirect('/admin/menus/create?error=' + encodeURIComponent('Failed to create menu: ' + (error as Error).message));
    }
  }

  /**
   * Render edit menu form
   */
  public static async editMenu(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.id;
      
      // Get menu by ID
      const menu = await menuService.getMenuById(menuId);
      if (!menu) {
        res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
        return;
      }
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get all pages for link selection
      const pages = await pagesService.getAllPages();

      res.render('menus/edit-menu', {
        title: 'Edit Menu',
        pageTitle: `Edit Menu: ${menu.name}`,
        pageSubtitle: 'Modify menu settings and items',
        menu: menu,
        pages: pages,
        siteTitle: siteTitle
      });
    } catch (error) {
      console.error('Error rendering edit menu:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit menu form submission
   */
  public static async editMenuPost(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.id;
      const { name, description } = req.body;

      // Update menu
      const updatedMenu = await menuService.updateMenu(menuId, { name, description });

      if (!updatedMenu) {
        res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
        return;
      }

      res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${updatedMenu.name}" updated successfully`));
    } catch (error) {
      console.error('Error updating menu:', error);
      res.redirect(`/admin/menus/${req.params.id}/edit?error=${encodeURIComponent('Failed to update menu')}`);
    }
  }

  /**
   * Delete menu
   */
  public static async deleteMenu(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.id;
      console.log('Attempting to delete menu with ID:', menuId);
      
      // Get menu to get name for success message
      const menu = await menuService.getMenuById(menuId);
      if (!menu) {
        console.log('Menu not found:', menuId);
        res.status(404).json({ success: false, error: 'Menu not found' });
        return;
      }

      // Delete menu
      console.log('Deleting menu:', menu.name);
      const deleted = await menuService.deleteMenu(menuId);
      console.log('Delete result:', deleted);
      
      if (!deleted) {
        console.log('Delete returned false for menu:', menuId);
        res.status(500).json({ success: false, error: 'Failed to delete menu' });
        return;
      }

      res.json({ success: true, message: `Menu "${menu.name}" deleted successfully` });
    } catch (error) {
      console.error('Error deleting menu:', error);
      res.status(500).json({ success: false, error: 'Failed to delete menu: ' + (error as Error).message });
    }
  }

  /**
   * Add menu item (AJAX)
   */
  public static async addMenuItem(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const { title, type, link, sort, active, parentId } = req.body;

      // Convert active to boolean properly
      const activeBoolean = active === true || active === 'true' || active === 1;
      
      // Validate menu item data
      const validation = menuService.validateMenuItemData({ title, type, link, sort: parseInt(sort), active: activeBoolean });
      if (!validation.isValid) {
        res.status(400).json({ success: false, errors: validation.errors });
        return;
      }

      let newItem;
      if (parentId) {
        // Add as child item
        newItem = await menuService.addChildMenuItem(menuId, parentId, {
          title: title.trim(),
          type,
          link: link.trim(),
          sort: parseInt(sort),
          active: activeBoolean
        });
      } else {
        // Add as top-level item
        newItem = await menuService.addMenuItem(menuId, {
          title: title.trim(),
          type,
          link: link.trim(),
          sort: parseInt(sort),
          active: activeBoolean
        });
      }

      if (!newItem) {
        res.status(400).json({ success: false, errors: ['Failed to add menu item'] });
        return;
      }

      res.json({ success: true, item: newItem });
    } catch (error) {
      console.error('Error adding menu item:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Update menu item (AJAX)
   */
  public static async updateMenuItem(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const itemId = req.params.itemId;
      const { title, type, link, sort, active } = req.body;

      // Convert active to boolean properly
      const activeBoolean = active === true || active === 'true' || active === 1;

      // Update menu item (placeholder - needs proper implementation)
      const updatedItem = {
        id: itemId,
        title: title.trim(),
        type,
        link: link.trim(),
        sort: parseInt(sort),
        active: activeBoolean,
        children: []
      };

      res.json({ success: true, item: updatedItem });
    } catch (error) {
      console.error('Error updating menu item:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Delete menu item (AJAX)
   */
  public static async deleteMenuItem(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const itemId = req.params.itemId;

      console.log('Deleting menu item:', itemId, 'from menu:', menuId);

      // Delete menu item using the service
      const deleted = await menuService.deleteMenuItem(menuId, itemId);

      if (!deleted) {
        res.status(400).json({ success: false, errors: ['Failed to delete menu item'] });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting menu item:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Move menu item (drag and drop) (AJAX)
   */
  public static async moveMenuItem(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const itemId = req.params.itemId;
      const { newSort, newParentId } = req.body;

      // Move menu item (placeholder - needs proper implementation)
      const moved = true;

      res.json({ success: true });
    } catch (error) {
      console.error('Error moving menu item:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Get menu items for AJAX requests
   */
  public static async getMenuItems(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.menuId;
      const menu = await menuService.getMenuById(menuId);
      if (!menu) {
        res.status(404).json({ success: false, errors: ['Menu not found'] });
        return;
      }

      res.json({ success: true, items: menu.items });
    } catch (error) {
      console.error('Error getting menu items:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Get pages for link selection (AJAX)
   */
  public static async getPages(req: Request, res: Response): Promise<void> {
    try {
      const pages = await pagesService.getAllPages();
      res.json({ success: true, pages });
    } catch (error) {
      console.error('Error getting pages:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Upload file for menu items (AJAX)
   */
  public static async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.files || !(req.files as any).file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const uploadedFile = (req.files as any).file;
      const customName = req.body.customName;

      // Validate file
      if (!uploadedFile.name || uploadedFile.size === 0) {
        res.status(400).json({ success: false, error: 'Invalid file' });
        return;
      }

      // Generate filename
      const originalName = uploadedFile.name;
      const extension = originalName.split('.').pop();
      const fileName = customName ? `${customName}.${extension}` : originalName;
      
      // Ensure downloads directory exists (DATA_PATHS resolves project root in both dev and dist)
      const downloadsDir = DATA_PATHS.DOWNLOADS_DIR;
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      // Save file
      const filePath = path.join(downloadsDir, fileName);
      await uploadedFile.mv(filePath);

      // Return the public path
      const publicPath = `/downloads/${fileName}`;
      
      res.json({ 
        success: true, 
        filePath: publicPath,
        fileName: fileName
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
  }
}
