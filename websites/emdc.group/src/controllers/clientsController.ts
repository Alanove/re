import { Request, Response } from 'express';
import { ClientsService } from '../../admin/services/clientsService';

const clientsService = ClientsService.getInstance();

export class ClientsController {
  /**
   * Render public clients page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      // Load all clients
      const clients = clientsService.getAllClients();
      
      res.render('clients', { 
        clients,
        pageTitle: 'Our Clients',
        pageDescription: 'Meet our valued clients who trust us with their projects.',
        pageKeywords: 'clients, partners, projects, EMDC Group',
        bodyClass: (res.locals as any).bodyClass + ' clients'
      });
    } catch (error) {
      console.error('Error rendering clients page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
