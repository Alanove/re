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

/** Seconds from multipart body (multiple names for multipart/browser quirks); undefined if nothing usable. */
function parseSlideDurationSecondsInput(body: Record<string, unknown>): number | undefined {
  const keys = ['duration_seconds_backup', 'duration_seconds', 'durationSeconds'] as const;
  let raw: unknown;
  for (const key of keys) {
    const v = body[key];
    if (v === undefined || v === null) continue;
    const piece = Array.isArray(v) ? v[v.length - 1] : v;
    const s = String(piece).trim();
    if (s !== '') {
      raw = piece;
      break;
    }
  }
  if (raw === undefined || raw === null) return undefined;
  const n = parseInt(String(raw).trim(), 10);
  if (isNaN(n) || n < 1) return undefined;
  return Math.min(600, n);
}

function parseSlideDurationSecondsForCreate(body: Record<string, unknown>): number {
  return parseSlideDurationSecondsInput(body) ?? 5;
}

/** On edit: use posted value if any field parsed; otherwise keep stored seconds (never drop the column from the update accidentally). */
function resolveSlideDurationSecondsForEdit(body: Record<string, unknown>, existingSeconds?: number): number {
  const parsed = parseSlideDurationSecondsInput(body);
  if (parsed !== undefined) return parsed;
  const ex = existingSeconds != null ? Number(existingSeconds) : NaN;
  if (!isNaN(ex) && ex > 0) return Math.min(600, Math.floor(ex));
  return 5;
}

export class SliderController {
  /**
   * Middleware to handle file uploads with error handling
   */
  public static handleSliderUpload(req: Request, res: Response, next: NextFunction): void {
    const uploadHandler = upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 },
      { name: 'mobile_image', maxCount: 1 },
      { name: 'mobile_video', maxCount: 1 }
    ]);

    uploadHandler(req as any, res as any, (err: any) => {
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
      
      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('slider/slider', {
        title: t('slider.title'),
        pageTitle: t('slider.pageTitle'),
        pageSubtitle: t('slider.pageSubtitle'),
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
      const emptySlide: Record<string, unknown> = {
        id: '',
        image: '',
        alt: '',
        order: 1,
        active: true,
        title: '',
        link: '',
        buttonText: '',
        mediaType: 'image' as 'image' | 'video',
        videoUrl: '',
        durationSeconds: 5,
        mobileImage: '',
        mobileVideo: ''
      };

      const copyFrom = typeof req.query['copyFrom'] === 'string' ? req.query['copyFrom'].trim() : '';
      let slide: Record<string, unknown> = emptySlide;
      if (copyFrom) {
        const src = await sliderService.getSlideById(copyFrom);
        if (src) {
          slide = {
            id: '',
            image: '',
            alt: src.alt || '',
            order: 1,
            active: src.active,
            title: src.title || '',
            link: src.link || '',
            buttonText: src.buttonText || '',
            mediaType: (src.mediaType as 'image' | 'video') || 'image',
            videoUrl: '',
            durationSeconds: src.durationSeconds != null && src.durationSeconds > 0 ? src.durationSeconds : 5,
            mobileImage: '',
            mobileVideo: ''
          };
        }
      }
      
      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('slider/edit-slide', {
        title: t('slider.addNewSlide'),
        pageTitle: t('slider.addNewSlide'),
        pageSubtitle: t('slider.pageSubtitle'),
        slide: slide,
        siteTitle: siteTitle,
        isEdit: false,
        error: typeof req.query['error'] === 'string' ? req.query['error'] : undefined
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
      const durationSeconds = parseSlideDurationSecondsForCreate(req.body as Record<string, unknown>);
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
      const mobileImageFile = files?.mobile_image?.[0];
      const mobileVideoFile = files?.mobile_video?.[0];
      
      if (!imageFile && !videoFile) {
        console.log('No files uploaded');
        res.redirect('/admin/slider/create?error=Please upload at least an image or video');
        return;
      }

      try {
        // Blank or the default "1" puts the new slide first. Any other number is kept.
        const orderText = order === undefined || order === null ? '' : String(order).trim();
        const parsedOrder = orderText === '' ? NaN : parseInt(orderText, 10);
        const orderNumber = !Number.isNaN(parsedOrder) && parsedOrder !== 1 ? parsedOrder : undefined;
        console.log('Parsed order:', orderNumber === undefined ? 'first' : orderNumber);
        
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
          posterImage,
          durationSeconds,
          mobileImageFile ? mobileImageFile.filename : null,
          mobileVideoFile ? mobileVideoFile.filename : null
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
      
      const t = (res.locals as any).t || ((key: string) => key);
      
      res.render('slider/edit-slide', {
        title: t('slider.editSlide'),
        pageTitle: t('slider.editSlide'),
        pageSubtitle: t('slider.pageSubtitle'),
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
        const existingSlide = await sliderService.getSlideById(id);
        if (!existingSlide) {
          res.redirect('/admin/slider?error=Slide not found');
          return;
        }

        const updates: any = {
          alt: alt.trim()
        };

        // Keep 0 as a real order. An empty field leaves the current order unchanged.
        if (order !== undefined && order !== null && String(order).trim() !== '') {
          const orderNumber = parseInt(String(order), 10);
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

        updates.durationSeconds = resolveSlideDurationSecondsForEdit(
          req.body as Record<string, unknown>,
          existingSlide.durationSeconds
        );

        updates.active =
          req.body.active === 'on' ||
          req.body.active === true ||
          req.body.active === 'true' ||
          req.body.active === '1';

        // Handle file uploads (partial updates: only replace what was uploaded)
        const imageFile = files?.image?.[0];
        const videoFile = files?.video?.[0];
        const mobileImageFile = files?.mobile_image?.[0];
        const mobileVideoFile = files?.mobile_video?.[0];

        if (imageFile || videoFile) {
          const isVideoSlide = existingSlide.mediaType === 'video' && !!existingSlide.videoUrl;

          if (imageFile && videoFile) {
            updates.mediaType = 'video';
            updates.videoUrl = videoFile.filename;
            updates.image = imageFile.filename;
            updates.posterImage = imageFile.filename;
          } else if (videoFile) {
            updates.mediaType = 'video';
            updates.videoUrl = videoFile.filename;
          } else if (imageFile) {
            if (isVideoSlide) {
              // New poster for a video slide; do not clear or replace the video file
              updates.mediaType = 'video';
              updates.image = imageFile.filename;
              updates.posterImage = imageFile.filename;
            } else {
              updates.mediaType = 'image';
              updates.image = imageFile.filename;
              updates.videoUrl = null;
              updates.posterImage = null;
            }
          }
        }

        const removeMobileImage = req.body.remove_mobile_image === '1' || req.body.remove_mobile_image === 'on';
        const removeMobileVideo = req.body.remove_mobile_video === '1' || req.body.remove_mobile_video === 'on';
        if (mobileImageFile) {
          updates.mobileImage = mobileImageFile.filename;
        } else if (removeMobileImage) {
          updates.mobileImage = null;
        }
        if (mobileVideoFile) {
          updates.mobileVideo = mobileVideoFile.filename;
        } else if (removeMobileVideo) {
          updates.mobileVideo = null;
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
      upload.single('image')(req as any, res as any, (err: any) => {
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