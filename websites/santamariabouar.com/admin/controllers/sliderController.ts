import { Request, Response, NextFunction } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SliderService } from '../services/sliderService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';

const menuService = AdminMenuService.getInstance();
const sliderService = SliderService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Get multer configurations from StorageService
const upload = storageService.createSliderUploadConfig();

export class SliderController {
  /**
   * Middleware to handle file uploads with error handling
   */
  public static handleSliderUpload(req: Request, res: Response, next: NextFunction): void {
    const uploadHandler = upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 }
    ]);

    uploadHandler(req, res, (err: any) => {
      if (err) {
        console.error('File upload error:', err);
        
        let errorMessage = 'File upload failed';
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          errorMessage = 'File is too large. Maximum size: 10MB for images, 100MB for videos';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          errorMessage = 'Unexpected file field. Please use the correct upload fields';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        // Determine redirect URL based on route
        const redirectUrl = req.params.id 
          ? `/admin/slider/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`
          : '/admin/slider/create?error=' + encodeURIComponent(errorMessage);
        
        res.redirect(redirectUrl);
        return;
      }
      
      next();
    });
  }
  /**
   * Render slider management page
   */
  public static async slider(req: Request, res: Response): Promise<void> {
    try {
      // Get slides from the slider service
      const slides = await sliderService.getAllSlides();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
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
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Create empty slide object for the form
      const emptySlide = {
        id: '',
        image: '',
        alt: '',
        order: 0,
        active: true,
        mediaType: 'image' as 'image' | 'video',
        videoUrl: ''
      };
      
      res.render('slider/edit-slide', {
        title: 'Add New Slide',
        pageTitle: 'Add New Slide',
        pageSubtitle: 'Add a new image or video to your home page slider',
        slide: emptySlide,
        siteTitle: siteTitle,
        isEdit: false
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
      console.log('Create slide post - body:', req.body);
      console.log('Create slide post - files:', req.files);
      
      const { alt, order, title, link, buttonText } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Validate required fields
      if (!alt || alt.trim() === '') {
        console.log('Validation failed: Alt text is required');
        res.redirect('/admin/slider/create?error=Alt text is required');
        return;
      }

      // Check if at least one file was uploaded (image or video)
      const imageFile = files?.image?.[0];
      const videoFile = files?.video?.[0];
      
      if (!imageFile && !videoFile) {
        console.log('No files uploaded');
        res.redirect('/admin/slider/create?error=Please upload at least an image or video');
        return;
      }

      try {
        // Parse order if provided
        const orderNumber = order ? parseInt(order) : undefined;
        console.log('Parsed order:', orderNumber);
        
        // Determine media type
        const mediaType = videoFile ? 'video' : 'image';
        console.log('Media type:', mediaType);
        
        // Set image and video filenames
        const imageFilename = imageFile ? imageFile.filename : (videoFile ? videoFile.filename : '');
        const videoUrl = videoFile ? videoFile.filename : undefined;
        const posterImage = (videoFile && imageFile) ? imageFile.filename : undefined;
        
        // Clean fields
        const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
        const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
        const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
        
        // Validate that if buttonText is provided, link must also be provided
        if (cleanButtonText && !cleanLink) {
          res.redirect('/admin/slider/create?error=Link URL is required when button text is provided');
          return;
        }
        
        // Add slide to service
        const newSlide = await sliderService.addSlide(
          imageFilename, 
          alt.trim(), 
          orderNumber, 
          cleanTitle, 
          cleanLink, 
          cleanButtonText,
          mediaType,
          videoUrl,
          posterImage
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
      
      // Get slide by ID
      const slide = await sliderService.getSlideById(id);
      if (!slide) {
        res.redirect('/admin/slider?error=Slide not found');
        return;
      }
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      res.render('slider/edit-slide', {
        title: 'Edit Slide',
        pageTitle: 'Edit Slide',
        pageSubtitle: 'Update slide information and image',
        slide: slide,
        siteTitle: siteTitle,
        isEdit: true
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
      const { alt, order, title, link, buttonText } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Validate required fields
      if (!alt || alt.trim() === '') {
        res.redirect(`/admin/slider/${id}/edit?error=Alt text is required`);
        return;
      }

      try {
        const updates: any = {
          alt: alt.trim()
        };

        // Parse order if provided
        if (order) {
          const orderNumber = parseInt(order);
          if (!isNaN(orderNumber)) {
            updates.order = orderNumber;
          }
        }

        // Clean fields
        const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
        const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
        const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
        
        // Validate that if buttonText is provided, link must also be provided
        if (cleanButtonText && !cleanLink) {
          res.redirect(`/admin/slider/${id}/edit?error=Link URL is required when button text is provided`);
          return;
        }
        
        updates.title = cleanTitle;
        updates.link = cleanLink;
        updates.buttonText = cleanButtonText;

        // Handle file uploads
        const imageFile = files?.image?.[0];
        const videoFile = files?.video?.[0];

        if (imageFile || videoFile) {
          // Determine media type
          const mediaType = videoFile ? 'video' : 'image';
          updates.mediaType = mediaType;
          
          if (imageFile) {
            updates.image = imageFile.filename;
            // If video is also uploaded, this is the poster image
            if (videoFile) {
              updates.posterImage = imageFile.filename;
            }
          }
          
          if (videoFile) {
            updates.videoUrl = videoFile.filename;
            // If no image provided, use video as fallback for image field
            if (!imageFile) {
              updates.image = videoFile.filename;
            }
          } else {
            // If no video but there's an image, clear video fields
            updates.videoUrl = null;
            updates.posterImage = null;
          }
        }

        // Update slide
        const updatedSlide = await sliderService.updateSlide(id, updates);
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
      const success = await sliderService.deleteSlide(id);
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
      const success = await sliderService.moveSlideUp(id);
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
      const success = await sliderService.moveSlideDown(id);
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
      const success = await sliderService.toggleSlideActive(id);
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
   * Upload image (AJAX endpoint)
   */
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      upload.single('image')(req, res, (err: any) => {
        if (err) {
          console.error('File upload error:', err);
          res.status(400).json({ error: 'File upload failed' });
          return;
        }

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
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 