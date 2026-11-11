import fs from 'fs';
import { DATA_PATHS } from '../constants/data-paths';

export interface Slide {
  id: string;
  image: string;
  alt: string;
  order: number;
  active: boolean;
  title?: string;
  link?: string;
  buttonText?: string;
}

export interface SliderData {
  slides: Slide[];
}

export class SliderService {
  private static instance: SliderService;
  private data: SliderData;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): SliderService {
    if (!SliderService.instance) {
      SliderService.instance = new SliderService();
    }
    return SliderService.instance;
  }

  /**
   * Load slider data from JSON file
   */
  private loadData(): SliderData {
    try {
      if (fs.existsSync(DATA_PATHS.SLIDER_FILE)) {
        const data = fs.readFileSync(DATA_PATHS.SLIDER_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading slider data:', error);
    }

    // Return default data if file doesn't exist or is invalid
    return {
      slides: []
    };
  }

  /**
   * Reload data from JSON file (useful after admin updates)
   */
  public reloadData(): void {
    this.data = this.loadData();
  }

  /**
   * Get active slides only (for public display)
   */
  public getActiveSlides(): Slide[] {
    return this.data.slides
      .filter(slide => slide.active)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all slides (for admin use)
   */
  public getAllSlides(): Slide[] {
    return this.data.slides.sort((a, b) => a.order - b.order);
  }

  /**
   * Get slide by ID
   */
  public getSlideById(id: string): Slide | null {
    return this.data.slides.find(slide => slide.id === id) || null;
  }

  /**
   * Get public URL for a slide image (filename or path like /uploads/...)
   */
  public getImageUrl(image: string): string {
    if (!image) {
      return '';
    }
    if (image.startsWith('/')) {
      return image;
    }
    return `/images/slide/${image}`;
  }
} 