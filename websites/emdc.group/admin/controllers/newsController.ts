import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AdminMenuService } from '../services/adminMenuService';
import { NewsService, AdminNewsData } from '../services/newsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import { videoEmbedService } from '../services/videoEmbedService';
import { DATA_PATHS } from '../../src/constants';

const menuService = AdminMenuService.getInstance();
const newsService = NewsService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Get multer configurations from StorageService
const upload = storageService.createNewsUploadConfig();
const editorUpload = storageService.createEditorUploadConfig();

export class NewsController {
  /**
   * Render news management page
   */
  public static async news(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/news');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get news from the news service
      const news = newsService.getAllNews();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Page-specific CSS - moved to admin.scss
      const pageCSS = '';

      // Page-specific JavaScript (REMOVE THIS)
      // const pageJS = ...
      res.render('news/news', {
        title: 'News Management',
        pageTitle: 'News Management',
        pageSubtitle: 'Manage your website news and content',
        pages: news,
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
  public static async createNews(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/news');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Create empty page object for the form
      const emptyNews = newsService.getEmptyNews();
      
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
      
      res.render('news/edit-news', {
        title: 'Create News',
        pageTitle: 'Create News',
        pageSubtitle: 'Add a new news item to your website',
        page: emptyNews,
        newsKey: '',
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
  public static async createNewsPost(req: Request, res: Response): Promise<void> {
    try {
      // Use multer to handle file uploads
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const formData = req.body;
          const emptyNews = newsService.getEmptyNews({
            key: formData.key || '',
            title: formData.title || '',
            url: formData.url || '',
            content: formData.content || '',
            pageImage: formData.pageImage || '',
            seo: {
              pageTitle: formData.pageTitle || '',
              pageDescription: formData.pageDescription || '',
              pageKeywords: formData.pageKeywords || '',
              pageImage: formData.pageImage || '',
              pageType: 'website'
            }
          });
          
          res.render('news/edit-news', {
            title: 'Create News',
            pageTitle: 'Create News',
            pageSubtitle: 'Add a new news item to your website',
            page: emptyNews,
            newsKey: '',
            isCreateMode: true,
            error: err.message || 'File upload error occurred.',
            siteTitle: siteSettingsService.getSiteTitle()
          });
          return;
        }

        const { key, title, url, content, pageImage, pageTitle, pageDescription, pageKeywords, usePageImage, isActive, includeInMenu, menuSort } = req.body;
        
        // Validation
        if (!key || !title) {
          const emptyNews = newsService.getEmptyNews({
            key: key || '',
            title: title || '',
            url: url || '',
            content: content || '',
            pageImage: pageImage || '',
            seo: {
              pageTitle: pageTitle || '',
              pageDescription: pageDescription || '',
              pageKeywords: pageKeywords || '',
              pageImage: pageImage || '',
              pageType: 'website'
            }
          });
          
          res.render('news/edit-news', {
            title: 'Create News',
            pageTitle: 'Create News',
            pageSubtitle: 'Add a new news item to your website',
            page: emptyNews,
            newsKey: '',
            isCreateMode: true,
            error: 'News key and title are required.',
            siteTitle: siteSettingsService.getSiteTitle()
          });
          return;
        }
        
        // Check if page key already exists
        const existingNewsByKey = newsService.getNewsByKey(key.trim());
        if (existingNewsByKey) {
          const emptyNews = newsService.getEmptyNews({
            key: key,
            title: title,
            url: url,
            content: content || '',
            pageImage: pageImage || '',
            seo: {
              pageTitle: pageTitle || '',
              pageDescription: pageDescription || '',
              pageKeywords: pageKeywords || '',
              pageImage: pageImage || '',
              pageType: 'website'
            }
          });
          
          res.render('news/edit-news', {
            title: 'Create News',
            pageTitle: 'Create News',
            pageSubtitle: 'Add a new news item to your website',
            page: emptyNews,
            newsKey: '',
            isCreateMode: true,
            error: 'A news item with this key already exists.',
            siteTitle: siteSettingsService.getSiteTitle()
          });
          return;
        }
        
        // Check if page URL already exists
        const pageUrl = url.trim() || `/${key.trim()}`;
        const existingNewsByUrl = newsService.getNewsByUrl(pageUrl);
        if (existingNewsByUrl) {
          const emptyNews = newsService.getEmptyNews({
            key: key,
            title: title,
            url: url,
            content: content || '',
            pageImage: pageImage || '',
            seo: {
              pageTitle: pageTitle || '',
              pageDescription: pageDescription || '',
              pageKeywords: pageKeywords || '',
              pageImage: pageImage || '',
              pageType: 'website'
            }
          });
          
          res.render('news/edit-news', {
            title: 'Create News',
            pageTitle: 'Create News',
            pageSubtitle: 'Add a new news item to your website',
            page: emptyNews,
            newsKey: '',
            isCreateMode: true,
            error: 'A news item with this URL already exists.',
            siteTitle: siteSettingsService.getSiteTitle()
          });
          return;
        }
        
        // Handle uploaded files
        let imagePath: string | undefined = undefined;
        let seoImagePath = storageService.getDefaultLogo();
        
        // Handle page image
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          imagePath = `/news/${key.trim()}/${files['pagePicture'][0].filename}`;
          console.log('New news image uploaded:', imagePath);
        } else if (pageImage && typeof pageImage === 'string' && pageImage.trim() !== '') {
          // Use existing image path if provided and valid
          imagePath = pageImage.trim();
        }
        
        // Handle SEO image file if uploaded
        if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
          seoImagePath = `/news/${key.trim()}/${files['seoImageFile'][0].filename}`;
          console.log('New SEO image uploaded:', seoImagePath);
        }
        // Note: seoImagePath defaults to storageService.getDefaultLogo() if no SEO image uploaded
        
        // Determine SEO image based on checkbox
        // If "use page image" is checked and page image exists, use it; otherwise use seoImagePath (which defaults to default logo)
        let finalSeoImage: string;
        if (usePageImage === '1' && imagePath && imagePath.trim() !== '') {
          finalSeoImage = imagePath;
        } else {
          // Ensure seoImagePath is valid, fallback to default logo
          finalSeoImage = (seoImagePath && seoImagePath.trim() !== '') 
            ? seoImagePath 
            : storageService.getDefaultLogo();
        }
        
        // Create new page - only include pageImage if it's a valid non-empty string
        const pageData: Omit<AdminNewsData, 'key'> & { key: string } = {
          key: key.trim(),
          title: title.trim(),
          url: pageUrl,
          content: content || '',
          status: (isActive ? 'published' : 'draft') as 'published' | 'draft',
          includeInMenu: includeInMenu === '1' || includeInMenu === true,
          menuSort: parseInt(menuSort) || 1000,
          seo: {
            pageTitle: pageTitle || '',
            pageDescription: pageDescription || '',
            pageKeywords: pageKeywords || '',
            pageImage: finalSeoImage,
            pageType: 'website'
          }
        };
        
        // Only add pageImage if it's a valid non-empty string
        if (imagePath && imagePath.trim() !== '') {
          pageData.pageImage = imagePath;
        }
        
        const newNews = newsService.createNews(pageData);
        
        if (newNews) {
          res.redirect('/admin/news?success=News created successfully');
        } else {
          const emptyNews = newsService.getEmptyNews({
            key: key,
            title: title,
            url: url,
            content: content || '',
            pageImage: pageImage || '',
            seo: {
              pageTitle: pageTitle || '',
              pageDescription: pageDescription || '',
              pageKeywords: pageKeywords || '',
              pageImage: pageImage || '',
              pageType: 'website'
            }
          });
          
          res.render('news/edit-news', {
            title: 'Create News',
            pageTitle: 'Create News',
            pageSubtitle: 'Add a new news item to your website',
            page: emptyNews,
            newsKey: '',
            isCreateMode: true,
            error: 'Failed to create news item. Please try again.',
            siteTitle: siteSettingsService.getSiteTitle()
          });
        }
      });
    } catch (error) {
      console.error('Error creating news:', error);
      const formData = req.body;
      const emptyNews = newsService.getEmptyNews({
        key: formData.key || '',
        title: formData.title || '',
        url: formData.url || '',
        content: formData.content || '',
        pageImage: formData.pageImage || '',
        seo: {
          pageTitle: formData.pageTitle || '',
          pageDescription: formData.pageDescription || '',
          pageKeywords: formData.pageKeywords || '',
          pageImage: formData.pageImage || '',
          pageType: 'website'
        }
      });
      
      res.render('news/edit-news', {
        title: 'Create News',
        pageTitle: 'Create News',
        pageSubtitle: 'Add a new news item to your website',
        page: emptyNews,
        newsKey: '',
        isCreateMode: true,
        error: 'An error occurred while creating the news item.',
        siteTitle: siteSettingsService.getSiteTitle()
      });
    }
  }

  /**
   * Render edit page form
   */
  public static async editNews(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/news');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      const newsKey = req.params['key'];
      if (!newsKey) {
        return res.redirect('/admin/news?error=News key is required');
      }
      
      // Check if this is create mode (newsKey = -1)
      if (newsKey === '-1') {
        // Redirect to create page
        return res.redirect('/admin/news/create');
      }
      
      const newsItem = newsService.getNewsByKey(newsKey);
      
      if (!newsItem) {
        return res.redirect('/admin/news?error=News not found');
      }
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      const defaultLogo = storageService.getDefaultLogo();
      
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
      
      res.render('news/edit-news', {
        title: 'Edit News',
        pageTitle: 'Edit News',
        pageSubtitle: 'Update news content and settings',
        page: newsItem,
        newsKey: newsKey || '',
        isCreateMode: false,
        siteTitle: siteTitle,
        defaultLogo: defaultLogo,
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
  public static async editNewsPost(req: Request, res: Response): Promise<void> {
    try {
      const newsKey = req.params['key'];
      if (!newsKey) {
        res.redirect('/admin/news?error=News key is required');
        return;
      }

      // Use multer to handle file uploads
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const existingNews = newsService.getNewsByKey(newsKey);
          res.render('news/edit-news', {
            title: 'Edit News',
            pageTitle: 'Edit News',
            pageSubtitle: 'Update news content and settings',
            page: existingNews,
            newsKey: newsKey,
            isCreateMode: false,
            error: err.message || 'File upload error occurred.'
          });
          return;
        }

        const { title, content, pageImage, seoImageUrl, pageTitle, pageDescription, pageKeywords, usePageImage, isActive, includeInMenu, menuSort } = req.body;
        
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
        const existingNews = newsService.getNewsByKey(newsKey);
        if (!existingNews) {
          res.redirect('/admin/news?error=News not found');
          return;
        }
        
        // Validation
        if (!title || title.trim() === '') {
          res.render('news/edit-news', {
            title: 'Edit News',
            pageTitle: 'Edit News',
            pageSubtitle: 'Update news content and settings',
            page: existingNews,
            newsKey: newsKey,
            isCreateMode: false,
            error: 'News title is required.'
          });
          return;
        }
        
        // Handle uploaded files
        // Normalize pageImage to string (handle array/object cases)
        const normalizeImagePath = (value: any): string | undefined => {
          if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
          }
          if (Array.isArray(value) && value.length > 0) {
            const firstValid = value.find((item: any) => typeof item === 'string' && item.trim() !== '');
            return firstValid ? firstValid.trim() : undefined;
          }
          return undefined;
        };
        
        let imagePath: string | undefined = normalizeImagePath(existingNews.pageImage);
        let seoImagePath: string = storageService.getDefaultLogo();
        
        // Handle page image upload
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          imagePath = `/news/${newsKey}/${files['pagePicture'][0].filename}`;
          console.log('New news image uploaded:', imagePath);
        } else {
          // Check if pageImage from form is valid (shouldn't be empty string)
          const formImagePath = normalizeImagePath(pageImage);
          if (formImagePath) {
            imagePath = formImagePath;
          }
          console.log('No new page image uploaded, keeping existing:', imagePath || 'none');
        }
        
        // Handle SEO image upload (only if not using page image)
        if (!(usePageImage === '1' || usePageImage === true)) {
          if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
            seoImagePath = `/news/${newsKey}/${files['seoImageFile'][0].filename}`;
            console.log('New SEO image uploaded:', seoImagePath);
          } else {
            // Check if seoImageUrl was provided from the form
            const formSeoImageUrl = normalizeImagePath(seoImageUrl);
            if (formSeoImageUrl) {
              seoImagePath = formSeoImageUrl;
              console.log('Using SEO image URL from form:', seoImagePath);
            } else {
              // Use existing SEO image or default
              const existingSeoImage = normalizeImagePath(existingNews.seo?.pageImage);
              // Only use existing if it's valid and not empty, and not pointing to a deleted page image
              if (existingSeoImage && existingSeoImage.trim() !== '') {
                // Check if the existing SEO image was pointing to the page image (which might be deleted)
                const existingNewsImage = normalizeImagePath(existingNews.pageImage);
                if (existingSeoImage === existingNewsImage && !imagePath) {
                  // SEO image was using page image, but page image is now deleted, use default
                  seoImagePath = storageService.getDefaultLogo();
                  console.log('SEO image was using deleted page image, switching to default logo');
                } else {
                  seoImagePath = existingSeoImage;
                  console.log('Using existing SEO image:', seoImagePath);
                }
              } else {
                seoImagePath = storageService.getDefaultLogo();
                console.log('No valid existing SEO image, using default logo');
              }
            }
          }
        } else {
          // Use page image for SEO - but only if page image exists and is valid
          if (imagePath && imagePath.trim() !== '') {
            // News image exists, use it for SEO
            const oldSeoImage = normalizeImagePath(existingNews.seo?.pageImage);
            if (oldSeoImage && oldSeoImage !== imagePath && oldSeoImage !== storageService.getDefaultLogo()) {
              // Delete the old SEO image file if it's different
              const oldSeoImagePath = path.join(DATA_PATHS.PUBLIC_DIR, oldSeoImage);
              storageService.deleteFile(oldSeoImagePath);
            }
            seoImagePath = imagePath;
            console.log('Using page image for SEO:', seoImagePath);
          } else {
            // News image doesn't exist, use default logo for SEO
            const oldSeoImage = normalizeImagePath(existingNews.seo?.pageImage);
            if (oldSeoImage && oldSeoImage !== storageService.getDefaultLogo()) {
              // Delete the old SEO image file if it was pointing to the deleted page image
              const oldSeoImagePath = path.join(DATA_PATHS.PUBLIC_DIR, oldSeoImage);
              storageService.deleteFile(oldSeoImagePath);
            }
            seoImagePath = storageService.getDefaultLogo();
            console.log('News image not available, using default logo for SEO:', seoImagePath);
          }
        }
        
        // Prepare update data - only include pageImage if it's a valid non-empty string
        const updateData: Partial<Omit<AdminNewsData, 'key'>> = {
          title: title.trim(),
          content: content || '',
          status: (isActive ? 'published' : 'draft') as 'published' | 'draft',
          includeInMenu: includeInMenu === '1' || includeInMenu === true,
          menuSort: parseInt(menuSort) || 1000,
          seo: {
            pageTitle: pageTitle || '',
            pageDescription: pageDescription || '',
            pageKeywords: pageKeywords || '',
            pageImage: seoImagePath && seoImagePath.trim() !== '' ? seoImagePath : storageService.getDefaultLogo(),
            pageType: 'website'
          }
        };
        
        // Only set pageImage if it's a valid non-empty string, otherwise delete it
        if (imagePath && imagePath.trim() !== '') {
          updateData.pageImage = imagePath;
        } else {
          // Explicitly set to empty string to trigger deletion in service
          updateData.pageImage = '';
        }
        
        // Update news
        console.log('Updating news with data:', JSON.stringify(updateData, null, 2));
        const updatedNews = newsService.updateNews(newsKey, updateData);
        console.log('Update result:', updatedNews ? 'Success' : 'Failed');
        
        if (updatedNews) {
          res.redirect('/admin/news?success=News updated successfully');
        } else {
          res.render('news/edit-news', {
            title: 'Edit News',
            pageTitle: 'Edit News',
            pageSubtitle: 'Update news content and settings',
            page: existingNews,
            newsKey: newsKey,
            isCreateMode: false,
            error: 'Failed to update page. Please try again.'
          });
        }
      });
    } catch (error) {
      console.error('Error updating page:', error);
      const newsKey = req.params['key'];
      const existingNews = newsKey ? newsService.getNewsByKey(newsKey) : null;
      
      res.render('news/edit-news', {
        title: 'Edit Page',
        pageTitle: 'Edit Page',
        pageSubtitle: 'Update page content and settings',
        page: existingNews,
        newsKey: newsKey || '',
        isCreateMode: false,
        error: 'An error occurred while updating the page.'
      });
    }
  }

  /**
   * Delete page
   */
  public static async deleteNews(req: Request, res: Response): Promise<void> {
    try {
      const newsKey = req.params['key'];
      if (!newsKey) {
        res.status(400).json({
          success: false,
          message: 'News key is required'
        });
        return;
      }
      
      // Check if news exists
      const existingNews = newsService.getNewsByKey(newsKey);
      if (!existingNews) {
        res.status(404).json({
          success: false,
          message: 'News not found'
        });
        return;
      }
      
      // Delete news folder and all its contents
      const newsFolderPath = path.join(DATA_PATHS.PUBLIC_DIR, 'news', newsKey);
      storageService.deleteDirectory(newsFolderPath);
      
      // Delete page
      const deleted = newsService.deleteNews(newsKey);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'News deleted successfully'
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
      
      const existingNews = newsService.getNewsByKey(key.trim());
      res.json({
        exists: !!existingNews,
        message: existingNews ? 'News key already exists' : 'News key is available'
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
      
      const existingNews = newsService.getNewsByUrl(url.trim());
      res.json({
        exists: !!existingNews,
        message: existingNews ? 'News URL already exists' : 'News URL is available'
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
  public static async deleteNewsImage(req: Request, res: Response): Promise<void> {
    try {
      const newsKey = req.params['key'];
      if (!newsKey) {
        res.status(400).json({
          success: false,
          message: 'News key is required'
        });
        return;
      }
      
      // Check if news exists
      const existingNews = newsService.getNewsByKey(newsKey);
      if (!existingNews) {
        res.status(404).json({
          success: false,
          message: 'News not found'
        });
        return;
      }
      
      // Check if news has an image (must be a non-empty string)
      // Handle both string and array cases (array is a data integrity issue but we need to handle it)
      const pageImageValue: unknown = existingNews.pageImage;
      const hasValidImage = pageImageValue && 
        (typeof pageImageValue === 'string' ? pageImageValue.trim() !== '' : 
         Array.isArray(pageImageValue) ? pageImageValue.length > 0 : false);
      
      // If no image exists, return success (idempotent operation - desired state already achieved)
      if (!hasValidImage) {
        // Even if no valid image, ensure the property is deleted
        if ('pageImage' in existingNews) {
          newsService.updateNews(newsKey, { pageImage: '' });
        }
        res.json({
          success: true,
          message: 'News has no image to delete (already removed)'
        });
        return;
      }
      
      // Delete the image file if it exists (handle errors gracefully)
      let fileDeleted = false;
      const pageImage = existingNews.pageImage;
      // Only attempt file deletion if pageImage is a string
      if (typeof pageImage === 'string' && pageImage.trim() !== '') {
        if (pageImage.startsWith('/news/') || pageImage.startsWith('/pages/') || pageImage.startsWith('/images/')) {
          try {
            const imagePath = path.join(DATA_PATHS.PUBLIC_DIR, pageImage);
            fileDeleted = storageService.deleteFile(imagePath);
          } catch (fileError) {
            // Log the error but continue with database update
            console.error('Error deleting image file:', fileError);
          }
        }
      } else {
        // Log if pageImage is not a string (data integrity issue)
        console.warn(`News ${newsKey} has invalid pageImage type:`, typeof pageImage, pageImage);
      }
      
      // Check if SEO image was using the deleted page image
      const seoImage = existingNews.seo?.pageImage;
      const wasUsingPageImage = seoImage && typeof pageImage === 'string' && 
        pageImage.trim() !== '' && seoImage === pageImage;
      
      // Update page to remove image reference from database
      // Pass empty string to delete the property
      const updateData: Partial<Omit<AdminNewsData, 'key'>> = { pageImage: '' };
      
      // If SEO image was using the deleted page image, update it to default logo
      if (wasUsingPageImage) {
        updateData.seo = {
          ...existingNews.seo,
          pageImage: storageService.getDefaultLogo()
        };
      }
      
      const updatedNews = newsService.updateNews(newsKey, updateData);
      
      if (!updatedNews) {
        res.status(500).json({
          success: false,
          message: 'Failed to update page record'
        });
        return;
      }
      
      // Verify the update worked - check if property was actually deleted
      const verifyNews = newsService.getNewsByKey(newsKey);
      const hasPageImageProperty = verifyNews && 'pageImage' in verifyNews;
      const verifyNewsImageValue = verifyNews?.pageImage;
      
      console.log('After deletion - pageImage value:', verifyNewsImageValue);
      console.log('After deletion - has pageImage property:', hasPageImageProperty);
      
      // If property still exists (shouldn't happen, but handle it), delete it directly
      if (hasPageImageProperty && verifyNews) {
        console.warn('PageImage property still exists after updateNews, deleting directly');
        delete verifyNews.pageImage;
        // Trigger a save by updating lastUpdated
        verifyNews.lastUpdated = new Date().toISOString();
        // Call updateNews again with lastUpdated to trigger savePages()
        newsService.updateNews(newsKey, { lastUpdated: verifyNews.lastUpdated });
      }
      
      // Don't reload here - the in-memory data is already updated
      // Reloading would read from file which might not be saved yet
      // The page reload in the frontend will load fresh data
      
      res.json({
        success: true,
        message: 'News image deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting page image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the page image'
      });
    }
  }

  /**
   * Upload image for editor
   */
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      // Debug logging
      console.log('Upload image request received:');
      console.log('Query:', req.query);
      
      // Use editorUpload to handle single image upload
      editorUpload.single('image')(req, res, async (err) => {
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
        const newsKey = req.body['newsKey'] || req.query['newsKey'];
        console.log('Extracted page key:', newsKey);
        
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            message: 'No image file provided'
          });
          return;
        }

        if (!newsKey || newsKey === 'generic') {
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
        
        // Create news-specific editor directory
        const newsEditorDir = path.join(DATA_PATHS.PUBLIC_DIR, 'news', newsKey, 'editor');
        if (!fs.existsSync(newsEditorDir)) {
          fs.mkdirSync(newsEditorDir, { recursive: true });
        }
        
        const newFilePath = path.join(newsEditorDir, filename);
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
      const newsKey = req.query.newsKey as string;

      if (!newsKey || newsKey === 'generic') {
        // Return generic images from public/images/generic
        const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
        const images = NewsController.getImagesFromDirectory(genericDir);
        res.json({ success: true, images });
        return;
      }

      // Get page-specific images
      const newsEditorDir = path.join(DATA_PATHS.PUBLIC_DIR, 'news', newsKey, 'editor');
      const images = NewsController.getImagesFromDirectory(newsEditorDir);
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
      const publicImages = NewsController.getImagesFromDirectory(publicImagesDir);
      images.push(...publicImages);

      // Get images from public/images/generic directory
      const genericDir = path.join(DATA_PATHS.IMAGES_DIR, 'generic');
      const genericImages = NewsController.getImagesFromDirectory(genericDir);
      images.push(...genericImages);

      // Get images from public/images/slide directory
      const slideDir = DATA_PATHS.SLIDER_DIR;
      const slideImages = NewsController.getImagesFromDirectory(slideDir);
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

  /**
   * Fetch video embed metadata (API endpoint)
   */
  public static async fetchVideoEmbed(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Video URL is required'
        });
        return;
      }

      const videoData = await videoEmbedService.fetchVideoMetadata(url);

      if (!videoData) {
        res.status(400).json({
          success: false,
          message: 'Could not fetch video information. Please ensure the URL is from YouTube, Vimeo, or Rutube.'
        });
        return;
      }

      // Include CSRF token in response so client can update it
      // csurf regenerates tokens on POST requests, so we need to return the new token
      const newCsrfToken = (req as any).csrfToken ? (req as any).csrfToken() : '';
      
      res.json({
        success: true,
        csrfToken: newCsrfToken, // Include new token in response
        ...videoData
      });
    } catch (error) {
      console.error('Error fetching video embed:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching video information'
      });
    }
  }
} 