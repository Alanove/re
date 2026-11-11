import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../constants';

export interface ContactInfo {
  id: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  coordinates: string; // Format: "latitude,longitude"
}

class ContactInfoService {
  private static instance: ContactInfoService;
  private contactInfoPath: string;
  private contactInfo: ContactInfo[] | null = null;
  private lastModified: number = 0;

  private constructor() {
    this.contactInfoPath = DATA_PATHS.CONTACT_INFO_FILE;
  }

  public static getInstance(): ContactInfoService {
    if (!ContactInfoService.instance) {
      ContactInfoService.instance = new ContactInfoService();
    }
    return ContactInfoService.instance;
  }

  /**
   * Load contact info from JSON file
   */
  private loadContactInfo(): ContactInfo[] {
    try {
      // Check if file exists and get its modification time
      if (fs.existsSync(this.contactInfoPath)) {
        const stats = fs.statSync(this.contactInfoPath);
        const currentModified = stats.mtime.getTime();
        
        // If file has been modified since last load, or contactInfo is null, reload
        if (!this.contactInfo || currentModified > this.lastModified) {
          const data = fs.readFileSync(this.contactInfoPath, 'utf8');
          this.contactInfo = JSON.parse(data);
          this.lastModified = currentModified;
        }
      } else {
        // Create default contact info if file doesn't exist
        this.contactInfo = [];
        this.saveContactInfo();
      }
    } catch (error) {
      console.error('Error loading contact info:', error);
      this.contactInfo = [];
    }

    return this.contactInfo!;
  }

  /**
   * Save contact info to JSON file
   */
  private saveContactInfo(): void {
    try {
      const dir = path.dirname(this.contactInfoPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.contactInfoPath, JSON.stringify(this.contactInfo, null, 2));
      
      // Update last modified time
      if (fs.existsSync(this.contactInfoPath)) {
        const stats = fs.statSync(this.contactInfoPath);
        this.lastModified = stats.mtime.getTime();
      }
    } catch (error) {
      console.error('Error saving contact info:', error);
      throw error;
    }
  }

  /**
   * Get all contact info
   */
  public getAllContactInfo(): ContactInfo[] {
    return this.loadContactInfo();
  }

  /**
   * Get contact info by ID
   */
  public getContactInfoById(id: string): ContactInfo | null {
    const allInfo = this.loadContactInfo();
    return allInfo.find(info => info.id === id) || null;
  }

  /**
   * Get contact info by country
   */
  public getContactInfoByCountry(country: string): ContactInfo[] {
    const allInfo = this.loadContactInfo();
    return allInfo.filter(info => info.country.toLowerCase() === country.toLowerCase());
  }

  /**
   * Update contact info
   */
  public updateContactInfo(newContactInfo: ContactInfo[]): boolean {
    try {
      this.contactInfo = newContactInfo;
      this.saveContactInfo();
      
      // Force reload to ensure we have the latest data
      this.contactInfo = null;
      this.lastModified = 0;
      
      return true;
    } catch (error) {
      console.error('Error updating contact info:', error);
      return false;
    }
  }

  /**
   * Add new contact info
   */
  public addContactInfo(contactInfo: ContactInfo): boolean {
    try {
      const allInfo = this.loadContactInfo();
      allInfo.push(contactInfo);
      return this.updateContactInfo(allInfo);
    } catch (error) {
      console.error('Error adding contact info:', error);
      return false;
    }
  }

  /**
   * Delete contact info by ID
   */
  public deleteContactInfo(id: string): boolean {
    try {
      const allInfo = this.loadContactInfo();
      const filtered = allInfo.filter(info => info.id !== id);
      return this.updateContactInfo(filtered);
    } catch (error) {
      console.error('Error deleting contact info:', error);
      return false;
    }
  }

  /**
   * Reload contact info from file (useful for development)
   */
  public reloadContactInfo(): void {
    this.contactInfo = null;
    this.lastModified = 0;
    this.loadContactInfo();
  }
}

export default ContactInfoService.getInstance();

