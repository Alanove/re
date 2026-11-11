import * as fs from 'fs';
import * as path from 'path';
import { SliderService } from '../../admin/services/sliderService';
import { DEFAULT_PAGE_HEADER_IMAGE } from '../constants/site-images';

export class ImageUtils {
  /**
   * Validate if an image file exists and return the correct path
   * @param imagePath - The image path to validate
   * @param publicDir - The public directory path (default: 'public')
   * @returns The validated image path or empty string if not found
   */
  public static validateImagePath(imagePath: string, publicDir: string = 'public'): string {
    if (!imagePath || imagePath.trim() === '') {
      return '';
    }

    // Ensure the path starts with /
    const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    // Check if file exists in public directory
    const fullPath = path.join(process.cwd(), publicDir, normalizedPath);
    
    try {
      if (fs.existsSync(fullPath)) {
        return normalizedPath;
      } else {
        console.warn(`Image not found: ${normalizedPath} (checked: ${fullPath})`);
        return '';
      }
    } catch (error) {
      console.error(`Error checking image path ${normalizedPath}:`, error);
      return '';
    }
  }

  /**
   * Get the best available image from multiple possible sources
   * @param sources - Array of possible image paths
   * @param publicDir - The public directory path (default: 'public')
   * @returns The first valid image path found
   */
  public static getBestImage(sources: string[], publicDir: string = 'public'): string {
    for (const source of sources) {
      const validatedPath = this.validateImagePath(source, publicDir);
      if (validatedPath) {
        return validatedPath;
      }
    }
    return '';
  }

  /**
   * CMS fields used for the hero/header background (excludes SEO social image).
   */
  public static getPageHeaderSources(pageData?: { pageImage?: string; image?: string } | null): string[] {
    if (!pageData) {
      return [];
    }
    return [pageData.pageImage, pageData.image].filter(
      (img): img is string => typeof img === 'string' && img.trim() !== ''
    );
  }

  /**
   * Resolve hero/header image from CMS page fields, then slider, then site default.
   */
  public static getPageHeaderImageFromPage(
    pageData?: { pageImage?: string; image?: string } | null,
    publicDir: string = 'public'
  ): string {
    return this.getPageHeaderImage(this.getPageHeaderSources(pageData), publicDir);
  }

  /**
   * Resolve the page header image from uploaded sources, falling back to a random slider image.
   */
  public static getPageHeaderImage(sources: string[], publicDir: string = 'public'): string {
    const uploaded = this.getBestImage(sources, publicDir);
    if (uploaded) {
      return uploaded;
    }

    const sliderImage = SliderService.getInstance().getRandomActiveSlideImage();
    const validatedSlider = this.validateImagePath(sliderImage, publicDir);
    if (validatedSlider) {
      return validatedSlider;
    }

    return this.validateImagePath(DEFAULT_PAGE_HEADER_IMAGE, publicDir) || DEFAULT_PAGE_HEADER_IMAGE;
  }

  /**
   * Check if an image path is valid (exists and is accessible)
   * @param imagePath - The image path to check
   * @param publicDir - The public directory path (default: 'public')
   * @returns True if the image exists and is accessible
   */
  public static isImageValid(imagePath: string, publicDir: string = 'public'): boolean {
    return this.validateImagePath(imagePath, publicDir) !== '';
  }

  /**
   * Get image information for debugging
   * @param imagePath - The image path to analyze
   * @param publicDir - The public directory path (default: 'public')
   * @returns Object with image information
   */
  public static getImageInfo(imagePath: string, publicDir: string = 'public'): {
    path: string;
    exists: boolean;
    fullPath: string;
    normalizedPath: string;
  } {
    const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    const fullPath = path.join(process.cwd(), publicDir, normalizedPath);
    const exists = fs.existsSync(fullPath);

    return {
      path: imagePath,
      exists,
      fullPath,
      normalizedPath
    };
  }
}
