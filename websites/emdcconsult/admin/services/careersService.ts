import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

// Career interface for admin
export interface CareerData {
  id: string;
  title: string;
  content: string;
  status?: 'published' | 'draft';
  lastUpdated?: string;
}

// Careers data interface
export interface CareersData {
  careers: CareerData[];
  introText?: string;
}

export class CareersService {
  private static instance: CareersService;
  private dataPath: string;
  private careersData: CareersData;

  private constructor() {
    this.dataPath = DATA_PATHS.CAREERS_FILE;
    this.careersData = this.loadCareers();
  }

  public static getInstance(): CareersService {
    if (!CareersService.instance) {
      CareersService.instance = new CareersService();
    }
    return CareersService.instance;
  }

  /**
   * Load careers from JSON file
   */
  private loadCareers(): CareersData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading careers:', error);
      return {
        careers: [],
        introText: ''
      };
    }
  }

  /**
   * Save careers to JSON file
   */
  private saveCareers(): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.careersData, null, 2), 'utf8');
      // Reload data from file to ensure in-memory data is in sync
      this.careersData = this.loadCareers();
    } catch (error) {
      console.error('Error saving careers:', error);
      throw new Error('Failed to save careers data');
    }
  }

  /**
   * Get all careers
   */
  public getAllCareers(): CareerData[] {
    return this.careersData.careers || [];
  }

  /**
   * Get published careers only
   */
  public getPublishedCareers(): CareerData[] {
    return (this.careersData.careers || []).filter(career => career.status === 'published');
  }

  /**
   * Get career by ID
   */
  public getCareerById(id: string): CareerData | null {
    return (this.careersData.careers || []).find(career => career.id === id) || null;
  }

  /**
   * Create new career
   */
  public createCareer(careerData: Omit<CareerData, 'id' | 'lastUpdated'>): CareerData {
    const newCareer: CareerData = {
      id: this.generateId(),
      title: careerData.title,
      content: careerData.content,
      status: careerData.status || 'draft',
      lastUpdated: new Date().toISOString()
    };

    if (!this.careersData.careers) {
      this.careersData.careers = [];
    }

    this.careersData.careers.push(newCareer);
    this.saveCareers();

    return newCareer;
  }

  /**
   * Update career
   */
  public updateCareer(id: string, updates: Partial<Omit<CareerData, 'id'>>): CareerData | null {
    const career = this.getCareerById(id);
    
    if (!career) {
      return null;
    }

    if (updates.title !== undefined) career.title = updates.title;
    if (updates.content !== undefined) career.content = updates.content;
    if (updates.status !== undefined) career.status = updates.status;
    
    // Always update the lastUpdated timestamp
    career.lastUpdated = new Date().toISOString();
    
    this.saveCareers();
    return career;
  }

  /**
   * Delete career
   */
  public deleteCareer(id: string): boolean {
    if (!this.careersData.careers) {
      return false;
    }

    const index = this.careersData.careers.findIndex(career => career.id === id);
    if (index === -1) {
      return false;
    }

    this.careersData.careers.splice(index, 1);
    this.saveCareers();
    return true;
  }

  /**
   * Get intro text
   */
  public getIntroText(): string {
    return this.careersData.introText || '';
  }

  /**
   * Update intro text
   */
  public updateIntroText(introText: string): void {
    this.careersData.introText = introText;
    this.saveCareers();
  }

  /**
   * Generate unique ID for career
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `career-${timestamp}-${random}`;
  }

  /**
   * Get careers count
   */
  public getCareersCount(): number {
    return (this.careersData.careers || []).length;
  }

  /**
   * Check if career exists
   */
  public careerExists(id: string): boolean {
    return !!this.getCareerById(id);
  }
}

// Export singleton instance
export const careersService = CareersService.getInstance();









