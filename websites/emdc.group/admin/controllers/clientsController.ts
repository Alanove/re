import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { ClientsService } from '../services/clientsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';

const menuService = AdminMenuService.getInstance();
const clientsService = ClientsService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

export class ClientsController {
  /**
   * Render clients management page
   */
  public static async clients(req: Request, res: Response): Promise<void> {
    try {
      menuService.setActiveMenuItem('/admin/clients');
      const adminMenu = menuService.getMenuItems();
      const clients = clientsService.getAllClients();
      const siteTitle = siteSettingsService.getSiteTitle();
      res.render('clients/clients', {
        title: 'Clients Management',
        pageTitle: 'Clients Management',
        pageSubtitle: 'Manage your clients',
        clients,
        siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        pageCSS: ''
      });
    } catch (error) {
      console.error('Error rendering clients:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create client form
   */
  public static async createClientForm(req: Request, res: Response): Promise<void> {
    menuService.setActiveMenuItem('/admin/clients');
    const siteTitle = siteSettingsService.getSiteTitle();
    const nextSortOrder = clientsService.getNextSortOrder();
    res.render('clients/edit-client', {
      title: 'Add Client',
      pageTitle: 'Add Client',
      client: null,
      nextSortOrder,
      siteTitle
    });
  }

  /**
   * Add new client
   */
  public static async addClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, sortOrder } = req.body;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!name || !file) {
        return res.redirect('/admin/clients?error=Name and image are required');
      }
      const id = 'client-' + Date.now();
      
      // Parse sortOrder or get next available
      let parsedSortOrder: number;
      if (sortOrder && !isNaN(parseInt(sortOrder))) {
        parsedSortOrder = parseInt(sortOrder);
      } else {
        parsedSortOrder = clientsService.getNextSortOrder();
      }
      
      clientsService.addClient({ id, name, image: file.filename, sortOrder: parsedSortOrder });
      res.redirect('/admin/clients?success=Client added');
    } catch (error) {
      console.error('Add client error:', error);
      res.redirect('/admin/clients?error=Failed to add client');
    }
  }

  /**
   * Render edit client form
   */
  public static async editClientForm(req: Request, res: Response): Promise<void> {
    const id = req.params['id'];
    const client = clientsService.getAllClients().find(c => c.id === id);
    if (!client) return res.redirect('/admin/clients?error=Client not found');
  // Ensure main Clients menu item is highlighted (edit URL won't match exact menu URL)
  menuService.setActiveMenuItem('/admin/clients');
    const siteTitle = siteSettingsService.getSiteTitle();
    res.render('clients/edit-client', {
      title: 'Edit Client',
      pageTitle: 'Edit Client',
      client,
      siteTitle
    });
  }

  /**
   * Update client
   */
  public static async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      const { name, sortOrder } = req.body;
      const file = (req as any).file as Express.Multer.File | undefined;
      const updates: any = { name };
      
      // Parse sortOrder if provided
      if (sortOrder && !isNaN(parseInt(sortOrder))) {
        updates.sortOrder = parseInt(sortOrder);
      }
      
      if (file) {
        updates.image = file.filename;
      }
      clientsService.updateClient(id, updates);
      res.redirect('/admin/clients?success=Client updated');
    } catch (error) {
      console.error('Update client error:', error);
      res.redirect('/admin/clients?error=Failed to update client');
    }
  }

  /**
   * Delete client
   */
  public static async deleteClient(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      clientsService.deleteClient(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete client' });
    }
  }

  /**
   * Move client up
   */
  public static async moveClientUp(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      const success = clientsService.moveClientUp(id);
      if (success) {
        res.redirect('/admin/clients?success=Client moved up successfully');
      } else {
        res.redirect('/admin/clients?error=Cannot move client up');
      }
    } catch (error) {
      console.error('Error moving client up:', error);
      res.redirect('/admin/clients?error=Failed to move client');
    }
  }

  /**
   * Move client down
   */
  public static async moveClientDown(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      const success = clientsService.moveClientDown(id);
      if (success) {
        res.redirect('/admin/clients?success=Client moved down successfully');
      } else {
        res.redirect('/admin/clients?error=Cannot move client down');
      }
    } catch (error) {
      console.error('Error moving client down:', error);
      res.redirect('/admin/clients?error=Failed to move client');
    }
  }
}
