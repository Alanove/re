import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SliderService } from '../services/sliderService';
import { SiteSettingsService } from '../services/siteSettingsService';
const menuService = AdminMenuService.getInstance();
const sliderService = SliderService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

function queryMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export class SliderController {
  /**
   * Render slider management page
   */
  public static async slider(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/slider');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get slides from the slider service
      const slides = sliderService.getAllSlides();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('slider/slider', {
        title: 'Home Page Slider',
        pageTitle: 'Home Page Slider',
        pageSubtitle: 'Manage your home page slider images and content',
        slides: slides,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering slider:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create slide form
   */
  public static async createSlide(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/slider');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Create empty slide object for the form
      const emptySlide = sliderService.getEmptySlide();
      
      res.render('slider/edit-slide', {
        title: 'Add New Slide',
        pageTitle: 'Add New Slide',
        pageSubtitle: 'Add a new image to your home page slider',
        slide: emptySlide,
        siteTitle: siteTitle,
        isEdit: false,
        error: queryMessage(req.query['error'])
      });
    } catch (error) {
      console.error('Error rendering create slide:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create slide form submission
   */
  public static async createSlidePost(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body ?? {};
      console.log('Create slide post - body:', body);
      console.log('Create slide post - file:', req.file);

      const { alt, order, title, link, buttonText, quoteText, quoteAuthor } = body as Record<string, string | undefined>;
      
      // Validate required fields
      if (!alt || alt.trim() === '') {
        console.log('Validation failed: Alt text is required');
        res.redirect('/admin/slider/create?error=Alt text is required');
        return;
      }

      const file = req.file;
      if (!file) {
        console.log('No file uploaded');
        res.redirect('/admin/slider/create?error=Please select an image file');
        return;
      }

      try {
        let orderNumber: number | undefined;
        if (order !== undefined && String(order).trim() !== '') {
          const parsed = parseInt(String(order), 10);
          orderNumber = Number.isFinite(parsed) ? parsed : undefined;
        }
        console.log('Parsed order:', orderNumber);
        
        // Clean fields
        const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
        const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
        const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
        const cleanQuoteText = quoteText && quoteText.trim() !== '' ? quoteText.trim() : undefined;
        const cleanQuoteAuthor = quoteAuthor && quoteAuthor.trim() !== '' ? quoteAuthor.trim() : undefined;
        
        // Validate that if buttonText is provided, link must also be provided
        if (cleanButtonText && !cleanLink) {
          res.redirect('/admin/slider/create?error=Link URL is required when button text is provided');
          return;
        }
        
        // Add slide to service
        const newSlide = sliderService.addSlide(
          file.filename,
          alt.trim(),
          orderNumber,
          cleanTitle,
          cleanLink,
          cleanButtonText,
          cleanQuoteText,
          cleanQuoteAuthor
        );
        console.log('Slide created successfully:', newSlide);
        
        res.redirect('/admin/slider?success=Slide added successfully');
      } catch (error) {
        console.error('Error creating slide:', error);
        res.redirect('/admin/slider/create?error=Failed to create slide');
      }
    } catch (error) {
      console.error('Error in create slide post:', error);
      res.redirect('/admin/slider/create?error=Internal server error');
    }
  }

  /**
   * Render edit slide form
   */
  public static async editSlide(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Set active menu item
      menuService.setActiveMenuItem('/admin/slider');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get slide by ID
      const slide = sliderService.getSlideById(id);
      if (!slide) {
        res.redirect('/admin/slider?error=Slide not found');
        return;
      }
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('slider/edit-slide', {
        title: 'Edit Slide',
        pageTitle: 'Edit Slide',
        pageSubtitle: 'Update slide information and image',
        slide: slide,
        siteTitle: siteTitle,
        isEdit: true,
        error: queryMessage(req.query['error'])
      });
    } catch (error) {
      console.error('Error rendering edit slide:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit slide form submission
   */
  public static async editSlidePost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body ?? {};
      const { alt, order, title, link, buttonText, quoteText, quoteAuthor } = body as Record<string, string | undefined>;
      
      // Validate required fields
      if (!alt || alt.trim() === '') {
        res.redirect(`/admin/slider/${id}/edit?error=Alt text is required`);
        return;
      }

      try {
        const updates: any = {
          alt: alt.trim()
        };

        if (order !== undefined && String(order).trim() !== '') {
          const orderNumber = parseInt(String(order), 10);
          if (Number.isFinite(orderNumber)) {
            updates.order = orderNumber;
          }
        }

        // Clean fields
        const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
        const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
        const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
        const cleanQuoteText = quoteText && quoteText.trim() !== '' ? quoteText.trim() : undefined;
        const cleanQuoteAuthor = quoteAuthor && quoteAuthor.trim() !== '' ? quoteAuthor.trim() : undefined;
        
        // Validate that if buttonText is provided, link must also be provided
        if (cleanButtonText && !cleanLink) {
          res.redirect(`/admin/slider/${id}/edit?error=Link URL is required when button text is provided`);
          return;
        }
        
        updates.title = cleanTitle;
        updates.link = cleanLink;
        updates.buttonText = cleanButtonText;
        updates.quoteText = cleanQuoteText;
        updates.quoteAuthor = cleanQuoteAuthor;

        // If a new image was uploaded, replace filename and remove previous file from disk
        const file = req.file;
        if (file) {
          const existing = sliderService.getSlideById(id);
          if (existing?.image && existing.image !== file.filename) {
            sliderService.removeImageFile(existing.image);
          }
          updates.image = file.filename;
        }

        // Update slide
        const updatedSlide = sliderService.updateSlide(id, updates);
        if (!updatedSlide) {
          res.redirect('/admin/slider?error=Slide not found');
          return;
        }
        
        res.redirect('/admin/slider?success=Slide updated successfully');
      } catch (error) {
        console.error('Error updating slide:', error);
        res.redirect(`/admin/slider/${id}/edit?error=Failed to update slide`);
      }
    } catch (error) {
      console.error('Error in edit slide post:', error);
      res.redirect(`/admin/slider/${req.params.id}/edit?error=Internal server error`);
    }
  }

  /**
   * Delete slide
   */
  public static async deleteSlide(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const success = sliderService.deleteSlide(id);
      if (success) {
        res.json({ success: true, message: 'Slide deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Slide not found' });
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      res.status(500).json({ success: false, message: 'Failed to delete slide' });
    }
  }

  /**
   * Move slide up
   */
  public static async moveSlideUp(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const success = sliderService.moveSlideUp(id);
      if (success) {
        res.redirect('/admin/slider?success=Slide moved up successfully');
      } else {
        res.redirect('/admin/slider?error=Cannot move slide up');
      }
    } catch (error) {
      console.error('Error moving slide up:', error);
      res.redirect('/admin/slider?error=Failed to move slide');
    }
  }

  /**
   * Move slide down
   */
  public static async moveSlideDown(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const success = sliderService.moveSlideDown(id);
      if (success) {
        res.redirect('/admin/slider?success=Slide moved down successfully');
      } else {
        res.redirect('/admin/slider?error=Cannot move slide down');
      }
    } catch (error) {
      console.error('Error moving slide down:', error);
      res.redirect('/admin/slider?error=Failed to move slide');
    }
  }

  /**
   * Toggle slide active status
   */
  public static async toggleSlideActive(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const success = sliderService.toggleSlideActive(id);
      if (success) {
        res.redirect('/admin/slider?success=Slide status updated successfully');
      } else {
        res.redirect('/admin/slider?error=Slide not found');
      }
    } catch (error) {
      console.error('Error toggling slide active:', error);
      res.redirect('/admin/slider?error=Failed to update slide status');
    }
  }

  /**
   * Upload image (AJAX endpoint) — multer + optimization run in sliderUploadAndOptimize middleware.
   */
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      res.json({
        success: true,
        filename: file.filename,
        url: sliderService.getImageUrl(file.filename)
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 