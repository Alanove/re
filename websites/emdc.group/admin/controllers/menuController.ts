import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
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
      // Set active menu item
      adminMenuService.setActiveMenuItem('/admin/menus');
      
      // Get menu data
      const adminMenu = adminMenuService.getMenuItems();
      
      // Get all menus
      const menus = menuService.getAllMenus();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get menu statistics
      const statistics = menuService.getMenuStatistics();

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
      // Set active menu item
      adminMenuService.setActiveMenuItem('/admin/menus');
      
      // Get menu data
      const adminMenu = adminMenuService.getMenuItems();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Create empty menu object for the form
      const emptyMenu = menuService.getEmptyMenu();

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

      // Validate menu data
      const validation = menuService.validateMenuData({ name, description });
      if (!validation.isValid) {
        res.redirect('/admin/menus/create?error=' + encodeURIComponent(validation.errors.join(', ')));
        return;
      }

      // Create menu
      const newMenu = menuService.createMenu({
        name: name.trim(),
        description: description.trim(),
        items: []
      });

      res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${newMenu.name}" created successfully`));
    } catch (error) {
      console.error('Error creating menu:', error);
      res.redirect('/admin/menus/create?error=' + encodeURIComponent('Failed to create menu'));
    }
  }

  /**
   * Render edit menu form
   */
  public static async editMenu(req: Request, res: Response): Promise<void> {
    try {
      const menuId = req.params.id;
      
      // Set active menu item
      adminMenuService.setActiveMenuItem('/admin/menus');
      
      // Get menu data
      const adminMenu = adminMenuService.getMenuItems();
      
      // Get menu by ID
      const menu = menuService.getMenuById(menuId);
      if (!menu) {
        res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
        return;
      }
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get all pages for link selection
      const pages = pagesService.getAllPages();

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

      // Validate menu data
      const validation = menuService.validateMenuData({ name, description });
      if (!validation.isValid) {
        res.redirect(`/admin/menus/${menuId}/edit?error=${encodeURIComponent(validation.errors.join(', '))}`);
        return;
      }

      // Update menu
      const updatedMenu = menuService.updateMenu(menuId, {
        name: name.trim(),
        description: description.trim()
      });

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
      
      // Get menu to get name for success message
      const menu = menuService.getMenuById(menuId);
      if (!menu) {
        res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
        return;
      }

      // Delete menu
      const deleted = menuService.deleteMenu(menuId);
      if (!deleted) {
        res.redirect('/admin/menus?error=' + encodeURIComponent('Failed to delete menu'));
        return;
      }

      res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${menu.name}" deleted successfully`));
    } catch (error) {
      console.error('Error deleting menu:', error);
      res.redirect('/admin/menus?error=' + encodeURIComponent('Failed to delete menu'));
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
        newItem = menuService.addChildMenuItem(menuId, parentId, {
          title: title.trim(),
          type,
          link: link.trim(),
          sort: parseInt(sort),
          active: activeBoolean
        });
      } else {
        // Add as top-level item
        newItem = menuService.addMenuItem(menuId, {
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
      
      // Validate menu item data
      const validation = menuService.validateMenuItemData({ title, type, link, sort: parseInt(sort), active: activeBoolean });
      if (!validation.isValid) {
        res.status(400).json({ success: false, errors: validation.errors });
        return;
      }

      // Update menu item
      const updatedItem = menuService.updateMenuItem(menuId, itemId, {
        title: title.trim(),
        type,
        link: link.trim(),
        sort: parseInt(sort),
        active: activeBoolean
      });

      if (!updatedItem) {
        res.status(400).json({ success: false, errors: ['Menu item not found'] });
        return;
      }

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

      console.log(`Attempting to delete menu item: menuId=${menuId}, itemId=${itemId}`);

      // Delete menu item
      const deleted = menuService.deleteMenuItem(menuId, itemId);
      console.log(`Delete result: ${deleted}`);
      
      if (!deleted) {
        console.log('Menu item not found for deletion');
        res.status(400).json({ success: false, errors: ['Menu item not found'] });
        return;
      }

      console.log('Menu item deleted successfully');
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

      // Move menu item
      const moved = menuService.moveMenuItem(menuId, itemId, parseInt(newSort), newParentId);
      if (!moved) {
        res.status(400).json({ success: false, errors: ['Failed to move menu item'] });
        return;
      }

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
      
      const menu = menuService.getMenuById(menuId);
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
      const pages = pagesService.getAllPages();
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
      
      // Ensure downloads directory exists
      const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
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
