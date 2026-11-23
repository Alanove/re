import { Request, Response, RequestHandler } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import { AdminMenuService } from '../services/adminMenuService';
import { MenuService } from '../services/menuService';
import { PagesService } from '../services/pagesService';
import { SiteSettingsService } from '../services/siteSettingsService';

const adminMenuService = AdminMenuService.getInstance();
const menuService = MenuService.getInstance();
const pagesService = PagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

// Create multer configuration for menu file uploads
const menuFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const menuFilesDir = path.join(process.cwd(), 'public', 'menu', 'files');
      if (!fs.existsSync(menuFilesDir)) {
        fs.mkdirSync(menuFilesDir, { recursive: true });
      }
      cb(null, menuFilesDir);
    },
    filename: (req, file, cb) => {
      const originalName = file.originalname;
      const extension = originalName.split('.').pop();
      const uniqueId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      const fileName = `${uniqueId}.${extension}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB file size limit
  }
});

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

      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('menus/menus', {
        title: t('menus.title'),
        pageTitle: t('menus.pageTitle'),
        pageSubtitle: t('menus.pageSubtitle'),
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

      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('menus/create-menu', {
        title: t('menus.createMenu'),
        pageTitle: t('menus.createNewMenu'),
        pageSubtitle: t('menus.addMenu'),
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
      
      // Don't load all pages - they will be loaded via AJAX autocomplete

      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('menus/edit-menu', {
        title: t('menus.editMenu'),
        pageTitle: `${t('menus.editMenu')}: ${menu.name}`,
        pageSubtitle: t('menus.updateMenu'),
        menu: menu,
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

      // Validate menu item data
      const updates: any = {
        title: title?.trim(),
        type: type || '',
        link: link?.trim() || '',
        sort: sort ? parseInt(sort) : undefined,
        active: activeBoolean
      };

      // Update menu item using the service
      const updatedItem = await menuService.updateMenuItem(menuId, itemId, updates);

      if (!updatedItem) {
        res.status(400).json({ success: false, errors: ['Failed to update menu item'] });
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

      // Validate inputs
      if (newSort === undefined || newSort === null) {
        res.status(400).json({ success: false, errors: ['New sort order is required'] });
        return;
      }

      // Move menu item using the service
      const moved = await menuService.moveMenuItem(menuId, itemId, parseInt(newSort), newParentId || null);

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
   * Supports search query parameter for autocomplete
   */
  public static async getPages(req: Request, res: Response): Promise<void> {
    try {
      const searchQuery = req.query.search as string;
      
      if (searchQuery && searchQuery.trim().length > 0) {
        // Return filtered results for autocomplete
        const pages = await pagesService.searchPages(searchQuery, 20);
        res.json({ success: true, pages });
      } else {
        // Return empty array if no search query (autocomplete will handle it)
        res.json({ success: true, pages: [] });
      }
    } catch (error) {
      console.error('Error getting pages:', error);
      res.status(500).json({ success: false, errors: ['Internal server error'] });
    }
  }

  /**
   * Upload file for menu items (AJAX)
   * Saves files to public/menu/files/ with unique IDs
   */
  public static uploadFile: RequestHandler[] = [
    menuFileUpload.single('file') as unknown as RequestHandler,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ success: false, error: 'No file uploaded' });
          return;
        }

        const uploadedFile = req.file;

        // Validate file
        if (!uploadedFile.originalname || uploadedFile.size === 0) {
          res.status(400).json({ success: false, error: 'Invalid file' });
          return;
        }

        // Return the public path
        const publicPath = `/menu/files/${uploadedFile.filename}`;
        
        res.json({ 
          success: true, 
          filePath: publicPath,
          fileName: uploadedFile.filename,
          originalName: uploadedFile.originalname
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, error: 'Failed to upload file' });
      }
    }
  ];
}
