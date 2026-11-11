// Service for managing clients
import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';
import * as path from 'path';

export interface Client {
  id: string;
  name: string;
  image: string; // just the filename
  sortOrder?: number; // sorting order (increments of 100: 100, 200, 300, etc.)
}

export class ClientsService {
  private static instance: ClientsService;
  private clientsPath: string;
  private clients: Client[];

  private constructor() {
    this.clientsPath = DATA_PATHS.CLIENTS_FILE;
    this.clients = this.loadClients();
  }

  public static getInstance(): ClientsService {
    if (!ClientsService.instance) {
      ClientsService.instance = new ClientsService();
    }
    return ClientsService.instance;
  }

  private loadClients(): Client[] {
    const data = JSON.parse(fs.readFileSync(this.clientsPath, 'utf-8'));
    // Normalize: accept either { image: 'file.png' } or { image: { filename: 'file.png' } }
    return (data.clients || []).map((c: any) => {
      let image = '';
      if (typeof c.image === 'string') {
        image = c.image;
      } else if (c.image && typeof c.image.filename === 'string') {
        image = c.image.filename;
      }
      return {
        id: c.id,
        name: c.name,
        image,
        sortOrder: c.sortOrder !== undefined ? c.sortOrder : 0
      };
    });
  }

  /**
   * Reload clients from file (useful after external file updates)
   */
  public reloadClients(): void {
    this.clients = this.loadClients();
  }

  public getAllClients(): Client[] {
    // Reload from file to ensure we have the latest data
    this.clients = this.loadClients();
    // Sort by sortOrder, then by name as fallback
    return [...this.clients].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 0;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get the next sortOrder value (increment by 100)
   */
  public getNextSortOrder(): number {
    if (this.clients.length === 0) {
      return 100;
    }
    const maxSortOrder = Math.max(...this.clients.map(c => c.sortOrder || 0));
    return maxSortOrder + 100;
  }

  public addClient(client: Client): void {
    this.clients.push(client);
    this.saveClients();
  }

  public updateClient(id: string, updated: Partial<Client>): void {
    const idx = this.clients.findIndex(c => c.id === id);
    if (idx !== -1) {
      // If updating image, remove old file (best effort)
      if (updated.image && this.clients[idx].image && updated.image !== this.clients[idx].image) {
        const oldPath = path.join(DATA_PATHS.IMAGES_DIR, 'clients', this.clients[idx].image);
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
      this.clients[idx] = { ...this.clients[idx], ...updated };
      this.saveClients();
    }
  }

  public deleteClient(id: string): void {
    const client = this.clients.find(c => c.id === id);
    if (client && client.image) {
      const imgPath = path.join(DATA_PATHS.IMAGES_DIR, 'clients', client.image);
      try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
    }
    this.clients = this.clients.filter(c => c.id !== id);
    this.saveClients();
  }

  /**
   * Move client up in order (swap sortOrder with previous client)
   */
  public moveClientUp(id: string): boolean {
    const sortedClients = this.getAllClients();
    const clientIndex = sortedClients.findIndex(c => c.id === id);
    
    if (clientIndex <= 0) {
      return false;
    }

    const currentClient = this.clients.find(c => c.id === id);
    const previousClient = this.clients.find(c => c.id === sortedClients[clientIndex - 1].id);
    
    if (!currentClient || !previousClient) {
      return false;
    }

    // Swap sortOrder values
    const tempSortOrder = currentClient.sortOrder || 0;
    const prevSortOrder = previousClient.sortOrder || 0;
    
    // If both have the same sortOrder, assign new values to create proper ordering
    if (tempSortOrder === prevSortOrder) {
      // Assign incrementing values based on position
      const baseOrder = (clientIndex - 1) * 100;
      previousClient.sortOrder = baseOrder;
      currentClient.sortOrder = baseOrder + 100;
    } else {
      // Swap normally
      currentClient.sortOrder = prevSortOrder;
      previousClient.sortOrder = tempSortOrder;
    }

    this.saveClients();
    return true;
  }

  /**
   * Move client down in order (swap sortOrder with next client)
   */
  public moveClientDown(id: string): boolean {
    const sortedClients = this.getAllClients();
    const clientIndex = sortedClients.findIndex(c => c.id === id);
    
    if (clientIndex === -1 || clientIndex >= sortedClients.length - 1) {
      return false;
    }

    const currentClient = this.clients.find(c => c.id === id);
    const nextClient = this.clients.find(c => c.id === sortedClients[clientIndex + 1].id);
    
    if (!currentClient || !nextClient) {
      return false;
    }

    // Swap sortOrder values
    const tempSortOrder = currentClient.sortOrder || 0;
    const nextSortOrder = nextClient.sortOrder || 0;
    
    // If both have the same sortOrder, assign new values to create proper ordering
    if (tempSortOrder === nextSortOrder) {
      // Assign incrementing values based on position
      const baseOrder = clientIndex * 100;
      currentClient.sortOrder = baseOrder + 100;
      nextClient.sortOrder = baseOrder;
    } else {
      // Swap normally
      currentClient.sortOrder = nextSortOrder;
      nextClient.sortOrder = tempSortOrder;
    }

    this.saveClients();
    return true;
  }

  private saveClients(): void {
    // Save only the reduced list
    fs.writeFileSync(this.clientsPath, JSON.stringify({ clients: this.clients }, null, 2));
  }
}
