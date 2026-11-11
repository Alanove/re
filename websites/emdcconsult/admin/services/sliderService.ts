import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../../src/constants/data-paths';

export interface Slide {
  id: string;
  image: string;
  alt: string;
  order: number;
  active: boolean;
  title?: string;
  link?: string;
  buttonText?: string;
  /** Optional hero quote shown above the slider; synced with this slide when the carousel advances. */
  quoteText?: string;
  quoteAuthor?: string;
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
   * Save slider data to JSON file
   */
  private saveData(): void {
    try {
      fs.writeFileSync(DATA_PATHS.SLIDER_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving slider data:', error);
      throw new Error('Failed to save slider data');
    }
  }

  /**
   * Reload data from JSON file (useful after admin updates)
   */
  public reloadData(): void {
    this.data = this.loadData();
  }

  /**
   * Get all slides
   */
  public getAllSlides(): Slide[] {
    return this.data.slides.sort((a, b) => a.order - b.order);
  }

  /**
   * Get active slides only
   */
  public getActiveSlides(): Slide[] {
    return this.data.slides
      .filter(slide => slide.active)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get slide by ID
   */
  public getSlideById(id: string): Slide | null {
    return this.data.slides.find(slide => slide.id === id) || null;
  }

  /**
   * Add new slide
   */
  public addSlide(
    image: string,
    alt: string,
    order?: number,
    title?: string,
    link?: string,
    buttonText?: string,
    quoteText?: string,
    quoteAuthor?: string
  ): Slide {
    const newId = this.generateId();
    let newOrder: number;
    
    if (order !== undefined) {
      newOrder = order;
    } else {
      const maxOrder = Math.max(...this.data.slides.map(s => s.order), 0);
      newOrder = maxOrder + 1;
    }
    
    const newSlide: Slide = {
      id: newId,
      image,
      alt,
      order: newOrder,
      active: true,
      ...(title && { title }),
      ...(link && { link }),
      ...(buttonText && { buttonText }),
      ...(quoteText && { quoteText }),
      ...(quoteAuthor && { quoteAuthor })
    };

    this.data.slides.push(newSlide);
    this.saveData();
    
    return newSlide;
  }

  /**
   * Update slide
   */
  public updateSlide(id: string, updates: Partial<Slide>): Slide | null {
    const slideIndex = this.data.slides.findIndex(slide => slide.id === id);
    
    if (slideIndex === -1) {
      return null;
    }

    this.data.slides[slideIndex] = {
      ...this.data.slides[slideIndex],
      ...updates
    };

    this.saveData();
    return this.data.slides[slideIndex];
  }

  /**
   * Remove a slide image from disk (best-effort). Basename only to avoid path traversal.
   */
  public removeImageFile(filename: string): void {
    if (!filename || typeof filename !== 'string') {
      return;
    }
    const safe = path.basename(filename.trim());
    if (!safe || safe === '.' || safe === '..') {
      return;
    }
    try {
      const imagePath = path.join(DATA_PATHS.SLIDER_DIR, safe);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (error) {
      console.error('Error removing slide image file:', error);
    }
  }

  /**
   * Delete slide
   */
  public deleteSlide(id: string): boolean {
    const slideIndex = this.data.slides.findIndex(slide => slide.id === id);
    
    if (slideIndex === -1) {
      return false;
    }

    // Get the slide to delete the image file
    const slide = this.data.slides[slideIndex];
    
    // Delete the image file
    try {
      const imagePath = path.join(DATA_PATHS.SLIDER_DIR, slide.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (error) {
      console.error('Error deleting slide image:', error);
    }

    // Remove slide from data
    this.data.slides.splice(slideIndex, 1);
    
    // Reorder remaining slides
    this.reorderSlides();
    
    this.saveData();
    return true;
  }

  /**
   * Reorder slides
   */
  public reorderSlides(): void {
    this.data.slides.forEach((slide, index) => {
      slide.order = index + 1;
    });
    this.saveData();
  }

  /**
   * Move slide up in order
   */
  public moveSlideUp(id: string): boolean {
    const slideIndex = this.data.slides.findIndex(slide => slide.id === id);
    
    if (slideIndex <= 0) {
      return false;
    }

    // Swap with previous slide
    const temp = this.data.slides[slideIndex];
    this.data.slides[slideIndex] = this.data.slides[slideIndex - 1];
    this.data.slides[slideIndex - 1] = temp;

    // Update order numbers
    this.reorderSlides();
    
    return true;
  }

  /**
   * Move slide down in order
   */
  public moveSlideDown(id: string): boolean {
    const slideIndex = this.data.slides.findIndex(slide => slide.id === id);
    
    if (slideIndex === -1 || slideIndex >= this.data.slides.length - 1) {
      return false;
    }

    // Swap with next slide
    const temp = this.data.slides[slideIndex];
    this.data.slides[slideIndex] = this.data.slides[slideIndex + 1];
    this.data.slides[slideIndex + 1] = temp;

    // Update order numbers
    this.reorderSlides();
    
    return true;
  }

  /**
   * Toggle slide active status
   */
  public toggleSlideActive(id: string): boolean {
    const slide = this.getSlideById(id);
    if (!slide) {
      return false;
    }

    slide.active = !slide.active;
    this.saveData();
    return true;
  }

  /**
   * Check if image file exists
   */
  public imageExists(imageName: string): boolean {
    const imagePath = path.join(DATA_PATHS.SLIDER_DIR, imageName);
    return fs.existsSync(imagePath);
  }

  /**
   * Get image URL for a slide
   */
  public getImageUrl(imageName: string): string {
    return `/images/slide/${imageName}`;
  }

  /**
   * Generate unique ID for new slides
   */
  private generateId(): string {
    const existingIds = this.data.slides.map(slide => parseInt(slide.id));
    const maxId = Math.max(...existingIds, 0);
    return (maxId + 1).toString();
  }

  /**
   * Get empty slide object for forms
   */
  public getEmptySlide(): Partial<Slide> {
    const maxOrder = Math.max(...this.data.slides.map(s => s.order), 0);
    return {
      id: '',
      image: '',
      alt: '',
      order: maxOrder + 1,
      active: true
    };
  }
} 