import { Request, Response, NextFunction } from 'express';
import { ImageUtils } from '../utils/imageUtils';

/**
 * Middleware to validate and ensure images are properly set in response locals
 */
export const validateImages = (req: Request, res: Response, next: NextFunction): void => {
  // Get the original render function
  const originalRender = res.render;
  
  // Override the render function to validate images before rendering
  res.render = function(view: string, options?: any, callback?: any) {
    if (options) {
      // Validate pageImage if it exists
      if (options.pageImage) {
        const validatedImage = ImageUtils.validateImagePath(options.pageImage);
        if (validatedImage !== options.pageImage) {
          console.warn(`Invalid pageImage replaced: ${options.pageImage} -> ${validatedImage}`);
          options.pageImage = validatedImage;
        }
      }
      
      // No backgroundImage handling needed - only pageImage is used
    }
    
    // Call the original render function
    return originalRender.call(this, view, options);
  };
  
  next();
};

/**
 * Middleware specifically for page routes to ensure proper image handling
 */
export const validatePageImages = (req: Request, res: Response, next: NextFunction): void => {
  // This middleware can be used on specific routes that need image validation
  const originalRender = res.render;
  
  res.render = function(view: string, options?: any, callback?: any) {
    if (options && view === 'page') {
      // Ensure we have the best available image
      const possibleImages = [
        options.pageImage,
        options.image
      ].filter(img => img && img.trim() !== '');
      
      if (possibleImages.length > 0) {
        options.pageImage = ImageUtils.getPageHeaderImage(possibleImages);
        console.log(`Page image validated and set: ${options.pageImage}`);
      }
    }
    
    return originalRender.call(this, view, options);
  };
  
  next();
};
