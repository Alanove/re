import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AdminMenuService } from '../services/adminMenuService';
import { PagesService } from '../services/pagesService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import { DATA_PATHS } from '../../src/constants';

const menuService = AdminMenuService.getInstance();
const pagesService = PagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Get multer configurations from StorageService
const upload = storageService.createPageUploadConfig();
const quillUpload = storageService.createQuillUploadConfig();

export class PagesController {
  /**
   * Transform page object to include seo structure for view compatibility
   */
  private static transformPageForView(page: any): any {
    if (!page) {
      return {
        title: '',
        key: '',
        slug: '',
        url: '',
        content: '',
        backgroundImage: '',
        status: 'draft',
        seo: {
          pageTitle: '',
          pageDescription: '',
          pageKeywords: '',
          pageImage: ''
        }
      };
    }
    
    return {
      ...page,
      key: page.slug || page.key || '',
      url: page.slug || page.url || '',
      backgroundImage: page.backgroundImage || '',
      seo: {
        pageTitle: (page.seo && page.seo.pageTitle) || page.title || '',
        pageDescription: (page.seo && page.seo.pageDescription) || page.metaDescription || '',
        pageKeywords: (page.seo && page.seo.pageKeywords) || page.metaKeywords || '',
        pageImage: (page.seo && page.seo.pageImage) || page.seoImage || page.backgroundImage || ''
      }
    };
  }

  /**
   * Render pages management page
   */
  public static async pages(req: Request, res: Response): Promise<void> {
    try {
      // Get pages from the pages service
      const pages = await pagesService.getAllPages();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Page-specific CSS - moved to admin.scss
      const pageCSS = '';

      res.render('pages/pages', {
        title: 'Pages Management',
        pageTitle: 'Pages Management',
        pageSubtitle: 'Manage your website pages and content',
        pages: pages,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        pageCSS: pageCSS
      });
    } catch (error) {
      console.error('Error rendering pages:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create page form
   */
  public static async createPage(req: Request, res: Response): Promise<void> {
    try {
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Create empty page object for the form
      const emptyPage = {
        title: '',
        key: '',
        slug: '',
        url: '',
        content: '',
        backgroundImage: '',
        status: 'draft',
        template: '',
        parentId: null,
        orderIndex: 0,
        seo: {
          pageTitle: '',
          pageDescription: '',
          pageKeywords: '',
          pageImage: ''
        }
      };
      
      // Page-specific CSS - moved to admin.scss
      const pageCSS = '';

      // Page-specific JavaScript
      const pageJS = `
        // Character count functionality
        document.addEventListener('DOMContentLoaded', function() {
          // Title character count
          const pageTitle = document.getElementById('pageTitle');
          const titleCount = document.getElementById('titleCount');
          
          if (pageTitle && titleCount) {
            pageTitle.addEventListener('input', function() {
              const length = this.value.length;
              titleCount.textContent = length + '/60';
              titleCount.className = 'character-count';
              
              if (length > 50) {
                titleCount.classList.add('warning');
              } else if (length > 60) {
                titleCount.classList.add('danger');
              }
            });
            pageTitle.dispatchEvent(new Event('input'));
          }
          
          // Description character count
          const pageDescription = document.getElementById('pageDescription');
          const descCount = document.getElementById('descCount');
          
          if (pageDescription && descCount) {
            pageDescription.addEventListener('input', function() {
              const length = this.value.length;
              descCount.textContent = length + '/160';
              descCount.className = 'character-count';
              
              if (length > 140) {
                descCount.classList.add('warning');
              } else if (length > 160) {
                descCount.classList.add('danger');
              }
            });
            pageDescription.dispatchEvent(new Event('input'));
          }
        });
      `;
      
      res.render('pages/edit-page', {
        title: 'Create Page',
        pageTitle: 'Create Page',
        pageSubtitle: 'Add a new page to your website',
        page: emptyPage,
        pageKey: '',
        isCreateMode: true,
        siteTitle: siteTitle,
        pageCSS: pageCSS,
        pageJS: pageJS,
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering create page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create page form submission
   */
  public static async createPagePost(req: Request, res: Response): Promise<void> {
    try {
      // Create empty page object for error cases
      const emptyPage = {
        title: '',
        key: '',
        slug: '',
        url: '',
        content: '',
        backgroundImage: '',
        status: 'draft',
        template: '',
        parentId: null,
        orderIndex: 0,
        seo: {
          pageTitle: '',
          pageDescription: '',
          pageKeywords: '',
          pageImage: ''
        }
      };

      // Use multer to handle file uploads
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          
          res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: err.message || 'File upload error occurred.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
          return;
        }

        const { key, title, url, content, backgroundImage, pageTitle, pageDescription, pageKeywords, pageImage, usePageImage, isActive, includeInMenu, menuSort } = req.body;
        
        // Validation
        if (!key || !title) {
          res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: 'Page key and title are required.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
          return;
        }
        
        // Check if page key already exists
        const existingPageByKey = await pagesService.getPageBySlug(key.trim());
        if (existingPageByKey) {
          res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: 'A page with this key already exists.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
          return;
        }
        
        // Handle uploaded files
        let imagePath = backgroundImage || '';
        let seoImagePath = pageImage || '';
        
        // Handle page image
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          imagePath = `/pages/${key.trim()}/${files['pagePicture'][0].filename}`;
        }
        
        // Handle SEO image file if uploaded
        if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
          seoImagePath = `/pages/${key.trim()}/${files['seoImageFile'][0].filename}`;
        }
        
        // Determine SEO image based on checkbox
        const finalSeoImage = usePageImage === '1' ? imagePath : seoImagePath;
        
        // Create new page using the service
        const newPage = await pagesService.createPage({
          title: title.trim(),
          slug: key.trim(),
          content: content || '',
          backgroundImage: imagePath || null,
          seoImage: finalSeoImage || null,
          metaDescription: pageDescription || '',
          metaKeywords: pageKeywords || '',
          status: (isActive === '1' || isActive === true) ? 'published' : 'draft',
          template: '',
          parentId: null,
          orderIndex: parseInt(menuSort) || 0
        });
        
        if (newPage) {
          res.redirect('/admin/pages?success=Page created successfully');
        } else {
          res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: 'Failed to create page. Please try again.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
        }
      });
    } catch (error) {
      console.error('Error creating page:', error);
      
      const emptyPage = {
        title: '',
        key: '',
        slug: '',
        url: '',
        content: '',
        backgroundImage: '',
        status: 'draft',
        template: '',
        parentId: null,
        orderIndex: 0,
        seo: {
          pageTitle: '',
          pageDescription: '',
          pageKeywords: '',
          pageImage: ''
        }
      };
      
      res.render('pages/edit-page', {
        title: 'Create Page',
        pageTitle: 'Create Page',
        pageSubtitle: 'Add a new page to your website',
        page: emptyPage,
        pageKey: '',
        isCreateMode: true,
        error: 'An error occurred while creating the page.',
        siteTitle: await siteSettingsService.getSiteTitle()
      });
    }
  }

  /**
   * Render edit page form
   */
  public static async editPage(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      // Get menu data
      const pageKey = req.params['key'];
      if (!pageKey) {
        return res.redirect('/admin/pages?error=Page key is required');
      }
      
      // Check if this is create mode (pageKey = -1)
      if (pageKey === '-1') {
        // Redirect to create page
        return res.redirect('/admin/pages/create');
      }
      
      const page = await pagesService.getPageByKey(pageKey);
      
      if (!page) {
        return res.redirect('/admin/pages?error=Page not found');
      }
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Page-specific CSS - moved to admin.scss
      const pageCSS = '';

      // Page-specific JavaScript
      const pageJS = `
        // Character count functionality
        document.addEventListener('DOMContentLoaded', function() {
          // Title character count
          const pageTitle = document.getElementById('pageTitle');
          const titleCount = document.getElementById('titleCount');
          
          if (pageTitle && titleCount) {
            pageTitle.addEventListener('input', function() {
              const length = this.value.length;
              titleCount.textContent = length + '/60';
              titleCount.className = 'character-count';
              
              if (length > 50) {
                titleCount.classList.add('warning');
              } else if (length > 60) {
                titleCount.classList.add('danger');
              }
            });
            pageTitle.dispatchEvent(new Event('input'));
          }
          
          // Description character count
          const pageDescription = document.getElementById('pageDescription');
          const descCount = document.getElementById('descCount');
          
          if (pageDescription && descCount) {
            pageDescription.addEventListener('input', function() {
              const length = this.value.length;
              descCount.textContent = length + '/160';
              descCount.className = 'character-count';
              
              if (length > 140) {
                descCount.classList.add('warning');
              } else if (length > 160) {
                descCount.classList.add('danger');
              }
            });
            pageDescription.dispatchEvent(new Event('input'));
          }
        });
      `;
      
      // Transform page data to match template expectations
      const transformedPage = PagesController.transformPageForView(page);

      res.render('pages/edit-page', {
        title: 'Edit Page',
        pageTitle: 'Edit Page',
        pageSubtitle: 'Update page content and settings',
        page: transformedPage,
        pageKey: pageKey || '',
        isCreateMode: false,
        siteTitle: siteTitle,
        pageCSS: pageCSS,
        pageJS: pageJS,
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering edit page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit page form submission
   */
  public static async editPagePost(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.redirect('/admin/pages?error=Page key is required');
        return;
      }

      // Use multer to handle file uploads
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const existingPage = await pagesService.getPageByKey(pageKey);
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: PagesController.transformPageForView(existingPage),
            pageKey: pageKey,
            isCreateMode: false,
            error: err.message || 'File upload error occurred.'
          });
          return;
        }

        const { title, content, backgroundImage, pageTitle, pageDescription, pageKeywords, pageImage, usePageImage, isActive, includeInMenu, menuSort } = req.body;
        
        // Debug logging
        console.log('Edit page form submission:');
        console.log('Files:', req.files);
        console.log('Body keys:', Object.keys(req.body));
        console.log('pageImage length:', req.body.pageImage?.length || 0);
        if (req.body.pageImage && req.body.pageImage.length > 1000) {
          console.log('pageImage starts with:', req.body.pageImage.substring(0, 100));
          console.log('pageImage is likely a base64 data URL');
        }
        
        // Get existing page
        const existingPage = await pagesService.getPageByKey(pageKey);
        if (!existingPage) {
          res.redirect('/admin/pages?error=Page not found');
          return;
        }
        
        // Validation
        if (!title || title.trim() === '') {
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: PagesController.transformPageForView(existingPage),
            pageKey: pageKey,
            isCreateMode: false,
            error: 'Page title is required.'
          });
          return;
        }
        
        // Handle uploaded files
        let imagePath = backgroundImage || '';
        let seoImagePath = pageImage || '';
        
        // Handle page image upload
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          imagePath = `/pages/${pageKey}/${files['pagePicture'][0].filename}`;
          console.log('New page image uploaded:', imagePath);
        } else {
          console.log('No new page image uploaded, keeping existing:', imagePath);
        }
        
        // Handle SEO image upload (only if not using page image)
        if (!(usePageImage === '1' || usePageImage === true)) {
          if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
            seoImagePath = `/pages/${pageKey}/${files['seoImageFile'][0].filename}`;
            console.log('New SEO image uploaded:', seoImagePath);
          } else {
            console.log('No new SEO image uploaded, using provided URL:', seoImagePath);
          }
        } else {
          // Use page image for SEO - delete old SEO image if it exists and is different
          const oldSeoImage = '';
          if (oldSeoImage && oldSeoImage !== imagePath && oldSeoImage !== '') {
            // Delete the old SEO image file
            const oldSeoImagePath = path.join(DATA_PATHS.PUBLIC_DIR, oldSeoImage);
            storageService.deleteFile(oldSeoImagePath);
          }
          seoImagePath = imagePath || '';
          console.log('Using page image for SEO:', seoImagePath);
        }
        
        // Prepare update data (match createPage field mapping)
        const updateData = {
          title: title.trim(),
          content: content || '',
          backgroundImage: imagePath || null,
          seoImage: seoImagePath || null,
          metaDescription: pageDescription || '',
          metaKeywords: pageKeywords || '',
          status: (isActive === '1' || isActive === true) ? 'published' as const : 'draft' as const,
          orderIndex: parseInt(menuSort) || 0
        };
        
        // Update page by numeric ID (pageKey is a slug, e.g. "about")
        const updatedPage = await pagesService.updatePage(existingPage.id, updateData);
        
        if (updatedPage) {
          res.redirect('/admin/pages?success=Page updated successfully');
        } else {
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: PagesController.transformPageForView(existingPage),
            pageKey: pageKey,
            isCreateMode: false,
            error: 'Failed to update page. Please try again.'
          });
        }
      });
    } catch (error) {
      console.error('Error updating page:', error);
      const pageKey = req.params['key'];
      const existingPage = pageKey ? await pagesService.getPageByKey(pageKey) : null;
      
      res.render('pages/edit-page', {
        title: 'Edit Page',
        pageTitle: 'Edit Page',
        pageSubtitle: 'Update page content and settings',
        page: PagesController.transformPageForView(existingPage),
        pageKey: pageKey || '',
        isCreateMode: false,
        error: 'An error occurred while updating the page.'
      });
    }
  }

  /**
   * Delete page
   */
  public static async deletePage(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.status(400).json({
          success: false,
          message: 'Page key is required'
        });
        return;
      }
      
      // Check if page exists
      const existingPage = await pagesService.getPageByKey(pageKey);
      if (!existingPage) {
        res.status(404).json({
          success: false,
          message: 'Page not found'
        });
        return;
      }
      
      // Delete page folder and all its contents
      const pageFolderPath = path.join(DATA_PATHS.PAGES_DIR, pageKey);
      storageService.deleteDirectory(pageFolderPath);
      
      // Delete page by numeric ID (pageKey is a slug)
      const deleted = await pagesService.deletePage(existingPage.id);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Page deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete page'
        });
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the page'
      });
    }
  }

  /**
   * Check if page key exists (API endpoint for client-side validation)
   */
  public static async checkPageKey(req: Request, res: Response): Promise<void> {
    try {
      const key = req.params['key'];
      if (!key) {
        res.status(400).json({
          exists: false,
          message: 'Key parameter is required'
        });
        return;
      }
      
        const existingPage = await pagesService.getPageByKey(key.trim());
      res.json({
        exists: !!existingPage,
        message: existingPage ? 'Page key already exists' : 'Page key is available'
      });
    } catch (error) {
      console.error('Error checking page key:', error);
      res.status(500).json({
        exists: false,
        message: 'An error occurred while checking the page key'
      });
    }
  }

  /**
   * Check if page URL exists (API endpoint for client-side validation)
   */
  public static async checkPageUrl(req: Request, res: Response): Promise<void> {
    try {
      const url = req.params['url'];
      if (!url) {
        res.status(400).json({
          exists: false,
          message: 'URL parameter is required'
        });
        return;
      }
      
      const existingPage = await pagesService.getPageBySlug(url.trim());
      res.json({
        exists: !!existingPage,
        message: existingPage ? 'Page URL already exists' : 'Page URL is available'
      });
    } catch (error) {
      console.error('Error checking page URL:', error);
      res.status(500).json({
        exists: false,
        message: 'An error occurred while checking the page URL'
      });
    }
  }

  /**
   * Delete page image
   */
  public static async deletePageImage(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.status(400).json({
          success: false,
          message: 'Page key is required'
        });
        return;
      }
      
      // Check if page exists
      const existingPage = await pagesService.getPageByKey(pageKey);
      if (!existingPage) {
        res.status(404).json({
          success: false,
          message: 'Page not found'
        });
        return;
      }
      
      // Delete the image file if it exists
      const imagePath = (existingPage as any).backgroundImage || '';
      if (imagePath) {
        const fullImagePath = path.join(DATA_PATHS.PUBLIC_DIR, imagePath.replace(/^\//, ''));
        storageService.deleteFile(fullImagePath);
      }
      
      // Clear stored image paths
      const updatedPage = await pagesService.updatePage(existingPage.id, {
        backgroundImage: null,
        seoImage: existingPage.seoImage === imagePath ? null : existingPage.seoImage
      });
      
      if (updatedPage) {
        res.json({
          success: true,
          message: 'Page image deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete page image'
        });
      }
    } catch (error) {
      console.error('Error deleting page image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the page image'
      });
    }
  }

  /**
   * Upload image for Quill editor
   */
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      // Debug logging
      console.log('Upload image request received:');
      console.log('Query:', req.query);
      
      // Use quillUpload to handle single image upload
      quillUpload.single('image')(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          res.status(400).json({
            success: false,
            message: err.message || 'File upload error occurred.'
          });
          return;
        }

        // Now that multer has parsed the form data, we can access req.body
        console.log('Body after multer:', req.body);
        console.log('Files after multer:', req.files);
        
        // Get page key from request body or query
        const pageKey = req.body['pageKey'] || req.query['pageKey'];
        console.log('Extracted page key:', pageKey);
        
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            message: 'No image file provided'
          });
          return;
        }

        if (!pageKey || pageKey === 'generic') {
          console.log('Using generic upload location for images');
          // For generic uploads, use public/images/generic directory
          const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
          if (!fs.existsSync(genericDir)) {
            fs.mkdirSync(genericDir, { recursive: true });
          }
          
          const filename = storageService.generateEditorFilename(file.originalname);
          const newFilePath = path.join(genericDir, filename);
          storageService.moveFile(file.path, newFilePath);
          
          // Return the public URL for the uploaded image
          const imageUrl = storageService.getPublicUrl(newFilePath);
          
          console.log('Generic image uploaded successfully:', imageUrl);
          res.json({
            success: true,
            url: imageUrl,
            message: 'Image uploaded successfully to generic location'
          });
          return;
        }

        // Generate a unique filename for the uploaded image
        const filename = storageService.generateEditorFilename(file.originalname);
        
        // Create page-specific editor directory
        const pageEditorDir = storageService.createPageEditorDirectory(pageKey);
        
        const newFilePath = path.join(pageEditorDir, filename);
        storageService.moveFile(file.path, newFilePath);
        
        // Return the public URL for the uploaded image
        const imageUrl = storageService.getPublicUrl(newFilePath);
        
        console.log('Image uploaded successfully:', imageUrl);
        res.json({
          success: true,
          url: imageUrl,
          message: 'Image uploaded successfully'
        });
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while uploading the image'
      });
    }
  }

  /**
   * Get images for a specific page
   */
  public static async getPageImages(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.query.pageKey as string;

      if (!pageKey || pageKey === 'generic') {
        // Return generic images from public/images/generic
        const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
        const images = PagesController.getImagesFromDirectory(genericDir);
        res.json({ success: true, images });
        return;
      }

      // Get page-specific images
      const pageEditorDir = path.join(DATA_PATHS.PAGES_DIR, pageKey, 'editor');
      const images = PagesController.getImagesFromDirectory(pageEditorDir);
      res.json({ success: true, images });
    } catch (error) {
      console.error('Error getting page images:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while getting page images'
      });
    }
  }

  /**
   * Get public images from various directories
   */
  public static async getPublicImages(req: Request, res: Response): Promise<void> {
    try {
      const images: any[] = [];
      
      // Get images from public/images directory
      const publicImagesDir = DATA_PATHS.IMAGES_DIR;
      const publicImages = PagesController.getImagesFromDirectory(publicImagesDir);
      images.push(...publicImages);

      // Get images from public/images/generic directory
      const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
      const genericImages = PagesController.getImagesFromDirectory(genericDir);
      images.push(...genericImages);

      // Get images from public/images/slide directory
      const slideDir = DATA_PATHS.SLIDER_DIR;
      const slideImages = PagesController.getImagesFromDirectory(slideDir);
      images.push(...slideImages);

      res.json({ success: true, images });
    } catch (error) {
      console.error('Error getting public images:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while getting public images'
      });
    }
  }

  /**
   * Helper method to get images from a directory
   */
  private static getImagesFromDirectory(dirPath: string): any[] {
    const images: any[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return images;
    }

    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
            const relativePath = path.relative(DATA_PATHS.PUBLIC_DIR, filePath);
            const publicUrl = '/' + relativePath.replace(/\\/g, '/');
            
            images.push({
              name: file,
              url: publicUrl,
              size: stats.size,
              modified: stats.mtime,
              path: filePath
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    return images;
  }
} 