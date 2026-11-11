import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import contactInfoService from '../../src/services/contactInfoService';
import { DATA_PATHS } from '../../src/constants';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Create multer configuration for site settings uploads
const multer = require('multer');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadDir = DATA_PATHS.IMAGES_DIR;
      console.log('Upload directory:', uploadDir);
      if (!fs.existsSync(uploadDir)) {
        console.log('Creating upload directory:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      let filename;
      
      if (file.fieldname === 'logoFile') {
        filename = `logo-${uniqueSuffix}${ext}`;
      } else if (file.fieldname === 'faviconFile') {
        filename = `favicon-${uniqueSuffix}${ext}`;
      } else if (file.fieldname === 'siteImageFile') {
        filename = `site-image-${uniqueSuffix}${ext}`;
      } else {
        filename = `site-${file.fieldname}-${uniqueSuffix}${ext}`;
      }
      
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  onError: (err: any, next: any) => {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      console.error('File too large');
    }
    next(err);
  },
      fileFilter: (req: any, file: any, cb: any) => {
      console.log('File being processed:', file.originalname, 'MIME type:', file.mimetype);
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/ico', 'image/x-icon'];
      if (allowedTypes.includes(file.mimetype)) {
        console.log('File type accepted:', file.mimetype);
        cb(null, true);
      } else {
        console.log('File type rejected:', file.mimetype);
        cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
      }
    }
});

export class SiteSettingsController {
  /**
   * Render site settings page
   */
  public static async siteSettings(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/site-settings');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Force reload settings to get latest data
      siteSettingsService.reloadSettings();
      
      // Get current site settings
      const settings = siteSettingsService.getAllSettings();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get contact info (office locations)
      const contactInfo = contactInfoService.getAllContactInfo();
      
      res.render('site-settings/site-settings', {
        title: 'Site Settings',
        pageTitle: 'Site Settings',
        pageSubtitle: 'Manage your website configuration and appearance',
        settings: settings,
        siteTitle: siteTitle,
        contactInfo: contactInfo,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering site settings:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle site settings update
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      console.log('Starting site settings update...');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      
      // Handle file uploads first
      upload.fields([
        { name: 'logoFile', maxCount: 1 },
        { name: 'faviconFile', maxCount: 1 },
        { name: 'siteImageFile', maxCount: 1 }
      ])(req, res, async (err: any) => {
        if (err) {
          console.error('File upload error:', err);
          console.error('Error details:', err.message);
          return res.redirect('/admin/site-settings?error=File upload failed: ' + err.message);
        }

        try {
          const currentSettings = siteSettingsService.getAllSettings();
          const updatedSettings: any = { ...currentSettings };

          // Update basic settings
          updatedSettings.siteTitle = req.body.siteTitle || '';
          updatedSettings.siteDescription = req.body.siteDescription || '';
          updatedSettings.siteUrl = req.body.siteUrl || '';
          updatedSettings.contactEmail = req.body.contactEmail || '';
          updatedSettings.careersEmail = req.body.careersEmail || '';
          updatedSettings.contactPhone = req.body.contactPhone || '';
          updatedSettings.address = req.body.address || '';

          // Update social media
          updatedSettings.socialMedia = {
            facebook: req.body.facebook || '',
            twitter: req.body.twitter || '',
            instagram: req.body.instagram || '',
            linkedin: req.body.linkedin || ''
          };

          // Update SEO settings
          updatedSettings.seo = {
            defaultTitle: req.body.defaultTitle || '',
            defaultDescription: req.body.defaultDescription || '',
            defaultKeywords: req.body.defaultKeywords || ''
          };

          // Update download links
          updatedSettings.downloadLinks = {
            portfolio: req.body.portfolioLink || '',
            brochure: req.body.brochureLink || '',
            catalog: req.body.catalogLink || ''
          };

          // Update success indicators
          updatedSettings.successIndicators = {
            totalProjects: req.body.successTotalProjects || '',
            totalProjectsShowPlus: req.body.successTotalProjectsShowPlus === 'on',
            totalCountries: req.body.successTotalCountries || '',
            totalCountriesShowPlus: req.body.successTotalCountriesShowPlus === 'on',
            specialists: req.body.successSpecialists || '48',
            specialistsShowPlus: req.body.successSpecialistsShowPlus === 'on',
            specialistsSublabel: req.body.successSpecialistsSublabel || 'Beirut - Cairo - Riyadh',
            totalClients: req.body.successTotalClients || '',
            totalClientsShowPlus: req.body.successTotalClientsShowPlus === 'on'
          };

          // Handle file uploads
          const files = req.files as { [fieldname: string]: Express.Multer.File[] };

          if (files['logoFile'] && files['logoFile'][0]) {
            const logoFile = files['logoFile'][0];
            const logoPath = `/images/${logoFile.filename}`;
            updatedSettings.logo = logoPath;
          }

          if (files['faviconFile'] && files['faviconFile'][0]) {
            const faviconFile = files['faviconFile'][0];
            const faviconPath = `/images/${faviconFile.filename}`;
            updatedSettings.favicon = faviconPath;
          }

          if (files['siteImageFile'] && files['siteImageFile'][0]) {
            const siteImageFile = files['siteImageFile'][0];
            const siteImagePath = `/images/${siteImageFile.filename}`;
            updatedSettings.siteImage = siteImagePath;
          }

          // Save updated settings
          const success = siteSettingsService.updateSettings(updatedSettings);

          if (success) {
            res.redirect('/admin/site-settings?success=Site settings updated successfully');
          } else {
            res.redirect('/admin/site-settings?error=Failed to update site settings');
          }
        } catch (error) {
          console.error('Error updating site settings:', error);
          res.redirect('/admin/site-settings?error=An error occurred while updating settings');
        }
      });
    } catch (error) {
      console.error('Error in updateSettings:', error);
      res.redirect('/admin/site-settings?error=An error occurred');
    }
  }

  /**
   * Test upload endpoint
   */
  public static async testUpload(req: Request, res: Response): Promise<any> {
    try {
      console.log('Test upload endpoint called');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      
      res.json({
        success: true,
        message: 'Test upload endpoint working',
        body: req.body,
        files: req.files
      });
    } catch (error) {
      console.error('Test upload error:', error);
      res.status(500).json({ error: 'Test upload failed' });
    }
  }

  /**
   * Delete site image
   */
  public static async deleteSiteImage(req: Request, res: Response): Promise<any> {
    try {
      const imageType = req.params['type']; // 'logo', 'favicon', or 'siteImage'
      const currentSettings = siteSettingsService.getAllSettings();
      
      let imagePath = '';
      let defaultPath = '';

      switch (imageType) {
        case 'logo':
          imagePath = currentSettings.logo;
          defaultPath = '/images/logo.jpg';
          break;
        case 'favicon':
          imagePath = currentSettings.favicon;
          defaultPath = '/images/favicon.ico';
          break;
        case 'siteImage':
          imagePath = (currentSettings as any).siteImage;
          defaultPath = '/images/site-image.jpg';
          break;
        default:
          return res.status(400).json({ error: 'Invalid image type' });
      }

      if (imagePath && imagePath !== defaultPath) {
        // Delete the file
        const fullPath = path.join(DATA_PATHS.PUBLIC_DIR, imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }

        // Update settings to use default
        const updatedSettings: any = { ...currentSettings };
        if (imageType === 'logo') {
          updatedSettings.logo = defaultPath;
        } else if (imageType === 'favicon') {
          updatedSettings.favicon = defaultPath;
        } else if (imageType === 'siteImage') {
          updatedSettings.siteImage = defaultPath;
        }

        siteSettingsService.updateSettings(updatedSettings);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting site image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
} 