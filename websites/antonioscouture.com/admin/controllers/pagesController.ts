import { Request, Response, RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import { AdminMenuService } from '../services/adminMenuService';
import { PagesService, Page, PageTag } from '../services/pagesService';
import { MenuService } from '../services/menuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import { videoEmbedService } from '../services/videoEmbedService';
import { DATA_PATHS } from '../../src/constants';
import securityService from '../../src/services/securityService';
import { deleteThumbFileForSourceImageUrl } from '../../src/services/imageThumbService';

const menuService = AdminMenuService.getInstance();
const pagesService = PagesService.getInstance();
const menuItemService = MenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Get multer configurations from StorageService
const upload = storageService.createPageUploadConfig();
const quillUpload = storageService.createQuillUploadConfig();
const galleryUpload = storageService.createPageGalleryUploadConfig();
const pageFileUpload = storageService.createPageFileUploadConfig();

export class PagesController {
  /**
   * Render pages management page
   */
  public static async pages(req: Request, res: Response): Promise<void> {
    try {
      // Get pagination and filter parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = parseInt(req.query.itemsPerPage as string) || 20;
      const keyword = req.query.keyword as string || '';
      const status = req.query.status as string || '';
      const tag = (req.query.tag as string || '').trim();
      
      // Get pages with pagination
      const paginationOptions: {
        page?: number;
        itemsPerPage?: number;
        keyword?: string;
        status?: string;
        tag?: string;
      } = {
        page,
        itemsPerPage
      };
      if (keyword) paginationOptions.keyword = keyword;
      if (status) paginationOptions.status = status;
      if (tag) paginationOptions.tag = tag;
      const result = await pagesService.getPagesWithPagination(paginationOptions);
      
      // Get all available tags for the filter dropdown
      const allTags = await pagesService.getAllTags();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Calculate pagination info
      const totalPages = Math.ceil(result.total / itemsPerPage);
      const startIndex = result.total > 0 ? (page - 1) * itemsPerPage + 1 : 0;
      const endIndex = Math.min(page * itemsPerPage, result.total);
      
      // Helper function to build pagination URL
      const buildPaginationUrl = (pageNum: number) => {
        const params = new URLSearchParams();
        if (keyword) params.set('keyword', keyword);
        if (status) params.set('status', status);
        if (tag) params.set('tag', tag);
        params.set('page', pageNum.toString());
        params.set('itemsPerPage', itemsPerPage.toString());
        return `/admin/pages?${params.toString()}`;
      };
      
      // Page-specific CSS - moved to admin.scss
      const pageCSS = '';

      res.render('pages/pages', {
        title: 'Pages Management',
        pageTitle: 'Pages Management',
        pageSubtitle: 'Manage your website pages and content',
        pages: result.pages,
        allTags: allTags,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        pageCSS: pageCSS,
        // Pagination data
        currentPage: page,
        itemsPerPage: itemsPerPage,
        totalPages: totalPages,
        totalItems: result.total,
        startIndex: startIndex,
        endIndex: endIndex,
        // Filter data
        currentKeyword: keyword,
        currentStatus: status,
        currentTag: tag,
        // Helper function
        buildPaginationUrl: buildPaginationUrl
      });
    } catch (error) {
      console.error('Error rendering pages:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render tags page
   */
  public static async tags(req: Request, res: Response): Promise<void> {
    try {
      // Get all available tags
      const allTags = await pagesService.getAllTags();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();

      res.render('pages/tags', {
        title: 'Tags',
        pageTitle: 'Tags',
        pageSubtitle: 'View all tags and filter pages by tag',
        tags: allTags,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering tags:', error);
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
        description: '',
        pageImage: '',
        seoImage: '',
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
              descCount.textContent = length + '/500';
              descCount.className = 'character-count';
              
              if (length > 450) {
                descCount.classList.add('warning');
              } else if (length > 500) {
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
        description: '',
        pageImage: '',
        seoImage: '',
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
      // Note: CSRF validation happens before multer, but for multipart forms,
      // the token is in the form data which multer will parse
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req as any, res as any, async (err) => {
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

        // After multer processes the form, verify CSRF token manually
        // (For multipart forms, CSRF validation is skipped in middleware and done here)
        const csrfToken = req.body?._csrf;
        if (!csrfToken) {
          console.error('CSRF token missing in form data after multer processing');
          return res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: 'Security token missing. Please refresh the page and try again.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
        }
        
        // Validate CSRF token manually after multer processes the form
        // For multipart forms, CSRF validation is deferred until after multer
        try {
          // Temporarily set body._csrf for validation (csurf expects it in body)
          const originalBody = req.body;
          req.body = { ...req.body, _csrf: csrfToken };
          
          // Validate using the same csrf instance from app.ts
          await new Promise<void>((resolve, reject) => {
            securityService.csrfProtection(req, res, (err: any) => {
              // Restore original body
              req.body = originalBody;
              
              if (err && err.code === 'EBADCSRFTOKEN') {
                reject(new Error('Invalid CSRF token'));
              } else if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        } catch (csrfErr: any) {
          console.error('CSRF validation failed after multer:', csrfErr);
          return res.render('pages/edit-page', {
            title: 'Create Page',
            pageTitle: 'Create Page',
            pageSubtitle: 'Add a new page to your website',
            page: emptyPage,
            pageKey: '',
            isCreateMode: true,
            error: 'Security token invalid. Please refresh the page and try again.',
            siteTitle: await siteSettingsService.getSiteTitle()
          });
        }

        const { key, title, url, content, description, pageTitle, pageDescription, pageKeywords, pageImage: pageImageRaw, seoImage: seoImageRaw, seoImageUrl, usePageImage, isActive, includeInMenu, menuSort, publishDate, pageTags } = req.body;
        
        // Normalize form fields - handle if they come as arrays
        const pageImage = Array.isArray(pageImageRaw) ? pageImageRaw[0] || '' : (pageImageRaw || '');
        // seoImage can come from hidden input or seoImageUrl text input
        let seoImage = Array.isArray(seoImageRaw) ? seoImageRaw[0] || '' : (seoImageRaw || '');
        // If seoImageUrl is provided (when usePageImage is unchecked), use that instead
        if (seoImageUrl && typeof seoImageUrl === 'string' && seoImageUrl.trim() !== '') {
          seoImage = seoImageUrl.trim();
        } else if (Array.isArray(seoImageUrl) && seoImageUrl.length > 0 && seoImageUrl[0]) {
          seoImage = seoImageUrl[0].trim();
        }
        
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
        let pageImagePath = '';
        let seoImagePath = '';
        
        // Handle page image upload
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          pageImagePath = `/pages/${key.trim()}/${files['pagePicture'][0].filename}`;
        } else if (pageImage) {
          // Use provided pageImage URL if no file uploaded
          pageImagePath = pageImage;
        }
        
        // Handle SEO image
        if (usePageImage === '1') {
          // Use page image for SEO
          seoImagePath = pageImagePath;
        } else {
          // Handle SEO image file upload
          if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
            seoImagePath = `/pages/${key.trim()}/${files['seoImageFile'][0].filename}`;
          } else if (seoImage) {
            // Use provided seoImage URL if no file uploaded
            seoImagePath = seoImage;
          }
        }
        
        // Parse tags from form data
        let tagNames: string[] = [];
        if (pageTags) {
          if (typeof pageTags === 'string') {
            try {
              tagNames = JSON.parse(pageTags);
            } catch {
              // If not JSON, treat as comma-separated string
              tagNames = pageTags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
            }
          } else if (Array.isArray(pageTags)) {
            tagNames = pageTags.map((tag: string) => tag.trim()).filter((tag: string) => tag);
          }
        }
        
        // Create new page using the service
        const pageData: Omit<Page, 'id' | 'createdAt' | 'updatedAt'> = {
          title: title.trim(),
          slug: key.trim(),
          content: content || '',
          metaDescription: pageDescription || '',
          metaKeywords: pageKeywords || '',
          status: (isActive === '1' || isActive === true) ? 'published' : 'draft',
          template: '',
          parentId: null,
          orderIndex: parseInt(menuSort) || 0,
          publishDate: publishDate || null
        };
        if (description) pageData.description = description.trim().substring(0, 1000);
        if (pageImagePath) pageData.pageImage = pageImagePath;
        if (seoImagePath) pageData.seoImage = seoImagePath;
        if (tagNames.length > 0) pageData.tags = tagNames as any;
        const newPage = await pagesService.createPage(pageData);
        
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
        description: '',
        pageImage: '',
        seoImage: '',
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
      
      console.log('Debug - pageKey:', pageKey);
      console.log('Debug - page found:', page);
      
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
              descCount.textContent = length + '/500';
              descCount.className = 'character-count';
              
              if (length > 450) {
                descCount.classList.add('warning');
              } else if (length > 500) {
                descCount.classList.add('danger');
              }
            });
            pageDescription.dispatchEvent(new Event('input'));
          }
        });
      `;
      
      // Get all available tags for the tags selector
      const allTags = await pagesService.getAllTags();

      // Transform page data to match template expectations
      const transformedPage = {
        ...page,
        key: page.slug, // Use slug as key for consistency
        url: page.slug,
        pageImage: page.pageImage || '', // Use existing page image from database
        seoImage: page.seoImage || '', // Use existing SEO image from database
        publishDate: page.publishDate || '',
        tags: page.tags || [],
        seo: {
          pageTitle: page.title || '',
          pageDescription: page.metaDescription || '',
          pageKeywords: page.metaKeywords || '',
          pageImage: page.seoImage || page.pageImage || '' // Use seoImage, fallback to pageImage
        }
      };

      res.render('pages/edit-page', {
        title: 'Edit Page',
        pageTitle: 'Edit Page',
        pageSubtitle: 'Update page content and settings',
        page: transformedPage,
        pageKey: pageKey || '',
        isCreateMode: false,
        allTags: allTags,
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
      // Note: CSRF validation happens after multer for multipart forms
      upload.fields([
        { name: 'pagePicture', maxCount: 1 },
        { name: 'seoImageFile', maxCount: 1 }
      ])(req as any, res as any, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const existingPage = await pagesService.getPageByKey(pageKey);
          if (!existingPage) {
            res.redirect('/admin/pages?error=Page not found');
            return;
          }
        }
        
        // After multer processes the form, verify CSRF token manually
        // (For multipart forms, CSRF validation is skipped in middleware and done here)
        const csrfToken = req.body?._csrf;
        if (!csrfToken) {
          console.error('CSRF token missing in form data after multer processing');
          const existingPage = await pagesService.getPageByKey(pageKey);
          if (!existingPage) {
            res.redirect('/admin/pages?error=Page not found');
            return;
          }
          // Re-render edit page with error
          const allTags = await pagesService.getAllTags();
          const siteTitle = await siteSettingsService.getSiteTitle();
          const pageCSS = '';
          const pageJS = '';
          
          const transformedPage = {
            ...existingPage,
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          return res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
            pageKey: pageKey || '',
            isCreateMode: false,
            allTags: allTags,
            siteTitle: siteTitle,
            pageCSS: pageCSS,
            pageJS: pageJS,
            includeCustomEditor: true,
            error: 'Security token missing. Please refresh the page and try again.'
          });
        }
        
        // Validate CSRF token manually after multer processes the form
        try {
          const originalBody = req.body;
          req.body = { ...req.body, _csrf: csrfToken };
          
          await new Promise<void>((resolve, reject) => {
            securityService.csrfProtection(req, res, (err: any) => {
              req.body = originalBody;
              
              if (err && err.code === 'EBADCSRFTOKEN') {
                reject(new Error('Invalid CSRF token'));
              } else if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        } catch (csrfErr: any) {
          console.error('CSRF validation failed after multer:', csrfErr);
          const existingPage = await pagesService.getPageByKey(pageKey);
          if (!existingPage) {
            res.redirect('/admin/pages?error=Page not found');
            return;
          }
          const allTags = await pagesService.getAllTags();
          const siteTitle = await siteSettingsService.getSiteTitle();
          const pageCSS = '';
          const pageJS = '';
          
          const transformedPage = {
            ...existingPage,
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          return res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
            pageKey: pageKey || '',
            isCreateMode: false,
            allTags: allTags,
            siteTitle: siteTitle,
            pageCSS: pageCSS,
            pageJS: pageJS,
            includeCustomEditor: true,
            error: 'Security token invalid. Please refresh the page and try again.'
          });
        }
        
        // Handle file upload error (if any) - but only if CSRF validation passed
        if (err) {
          // Transform page data to match template expectations
          const existingPage = await pagesService.getPageByKey(pageKey);
          if (!existingPage) {
            res.redirect('/admin/pages?error=Page not found');
            return;
          }
          
          const transformedPage = {
            ...existingPage,
            key: existingPage.slug,
            url: existingPage.slug,
            pageImage: existingPage.pageImage || '',
            seoImage: existingPage.seoImage || '',
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
            pageKey: pageKey,
            isCreateMode: false,
            error: err.message || 'File upload error occurred.'
          });
          return;
        }

        const { title, key, url, content, description, pageTitle, pageDescription, pageKeywords, pageImage: pageImageRaw, seoImage: seoImageRaw, seoImageUrl, usePageImage, isActive, includeInMenu, menuSort, publishDate, pageTags } = req.body;
        
        // Normalize form fields - handle if they come as arrays
        const pageImage = Array.isArray(pageImageRaw) ? pageImageRaw[0] || '' : (pageImageRaw || '');
        // seoImage can come from hidden input or seoImageUrl text input
        let seoImage = Array.isArray(seoImageRaw) ? seoImageRaw[0] || '' : (seoImageRaw || '');
        // If seoImageUrl is provided (when usePageImage is unchecked), use that instead
        if (seoImageUrl && typeof seoImageUrl === 'string' && seoImageUrl.trim() !== '') {
          seoImage = seoImageUrl.trim();
        } else if (Array.isArray(seoImageUrl) && seoImageUrl.length > 0 && seoImageUrl[0]) {
          seoImage = seoImageUrl[0].trim();
        }
        
        // Debug logging
        console.log('Edit page form submission:');
        console.log('Files:', req.files);
        console.log('Body keys:', Object.keys(req.body));
        
        // Get existing page
        const existingPage = await pagesService.getPageByKey(pageKey);
        if (!existingPage) {
          res.redirect('/admin/pages?error=Page not found');
          return;
        }
        
        // Validation
        if (!title || title.trim() === '') {
          // Transform page data to match template expectations
          const transformedPage = {
            ...existingPage,
            key: existingPage.slug,
            url: existingPage.slug,
            pageImage: existingPage.pageImage || '',
            seoImage: existingPage.seoImage || '',
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
            pageKey: pageKey,
            isCreateMode: false,
            error: 'Page title is required.'
          });
          return;
        }
        
        // Validate key and URL if provided
        const newKey = key ? key.trim() : existingPage.slug;
        const newUrl = url ? url.trim() : existingPage.slug;
        
        // Normalize key - remove leading / if present (slug doesn't have leading slash)
        const normalizedKey = newKey.startsWith('/') ? newKey.substring(1) : newKey;
        
        // Normalize URL - ensure it starts with / for display, but remove for slug comparison
        const normalizedUrl = newUrl.startsWith('/') ? newUrl : '/' + newUrl;
        const urlSlug = normalizedUrl.startsWith('/') ? normalizedUrl.substring(1) : normalizedUrl;
        
        // Ensure key and URL are consistent (URL should be key with leading slash)
        // If they don't match, use the key and update URL to match
        if (normalizedKey !== urlSlug) {
          // Use key as the source of truth, update URL to match
          console.warn(`Key (${normalizedKey}) and URL slug (${urlSlug}) don't match. Using key as slug.`);
        }
        
        // Check key uniqueness (excluding current page)
        if (normalizedKey !== existingPage.slug) {
          const keyExists = await pagesService.getPageByKey(normalizedKey);
          if (keyExists && keyExists.id !== existingPage.id) {
            const transformedPage = {
              ...existingPage,
              key: existingPage.slug,
              url: existingPage.slug,
              pageImage: existingPage.pageImage || '',
              seoImage: existingPage.seoImage || '',
              seo: {
                pageTitle: existingPage.title || '',
                pageDescription: existingPage.metaDescription || '',
                pageKeywords: existingPage.metaKeywords || '',
                pageImage: existingPage.seoImage || existingPage.pageImage || ''
              }
            };
            
            res.render('pages/edit-page', {
              title: 'Edit Page',
              pageTitle: 'Edit Page',
              pageSubtitle: 'Update page content and settings',
              page: transformedPage,
              pageKey: pageKey,
              isCreateMode: false,
              error: 'Page key already exists. Please choose a different one.'
            });
            return;
          }
        }
        
        // Check URL uniqueness (excluding current page) - use normalizedKey since key is source of truth
        if (normalizedKey !== existingPage.slug) {
          const urlExists = await pagesService.getPageBySlug(normalizedKey);
          if (urlExists && urlExists.id !== existingPage.id) {
            const transformedPage = {
              ...existingPage,
              key: existingPage.slug,
              url: existingPage.slug,
              pageImage: existingPage.pageImage || '',
              seoImage: existingPage.seoImage || '',
              seo: {
                pageTitle: existingPage.title || '',
                pageDescription: existingPage.metaDescription || '',
                pageKeywords: existingPage.metaKeywords || '',
                pageImage: existingPage.seoImage || existingPage.pageImage || ''
              }
            };
            
            res.render('pages/edit-page', {
              title: 'Edit Page',
              pageTitle: 'Edit Page',
              pageSubtitle: 'Update page content and settings',
              page: transformedPage,
              pageKey: pageKey,
              isCreateMode: false,
              error: 'Page URL already exists. Please choose a different one.'
            });
            return;
          }
        }
        
        // Handle uploaded files
        // Start with existing page's pageImage if available
        let pageImagePath: string | null = existingPage.pageImage || null;
        let seoImagePath: string | null = existingPage.seoImage || null;
        
        // Handle key/URL change - need to rename folder if key changed
        const oldKey = existingPage.slug;
        const newSlug = normalizedKey;
        let folderRenamed = false;
        
        if (oldKey !== newSlug) {
          // Rename the page folder
          const oldFolderPath = path.join(DATA_PATHS.PAGES_DIR, oldKey);
          const newFolderPath = path.join(DATA_PATHS.PAGES_DIR, newSlug);
          
          if (fs.existsSync(oldFolderPath)) {
            try {
              fs.renameSync(oldFolderPath, newFolderPath);
              folderRenamed = true;
              console.log(`Renamed page folder from ${oldKey} to ${newSlug}`);
              
              // Update image paths if they reference the old folder
              if (existingPage.pageImage && existingPage.pageImage.includes(`/pages/${oldKey}/`)) {
                pageImagePath = existingPage.pageImage.replace(`/pages/${oldKey}/`, `/pages/${newSlug}/`);
              }
              if (existingPage.seoImage && existingPage.seoImage.includes(`/pages/${oldKey}/`)) {
                seoImagePath = existingPage.seoImage.replace(`/pages/${oldKey}/`, `/pages/${newSlug}/`);
              }
            } catch (error) {
              console.error('Error renaming page folder:', error);
              // Continue with update but log the error
            }
          }
        }
        
        // Handle page image upload
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
          pageImagePath = `/pages/${newSlug}/${files['pagePicture'][0].filename}`;
          console.log('New page image uploaded:', pageImagePath);
        }
        
        // Handle SEO image
        if (usePageImage === '1') {
          // Use page image for SEO
          seoImagePath = pageImagePath;
          console.log('Using page image for SEO:', seoImagePath);
        } else {
          // Handle SEO image file upload
          if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
            seoImagePath = `/pages/${newSlug}/${files['seoImageFile'][0].filename}`;
            console.log('New SEO image uploaded:', seoImagePath);
          } else if (seoImage && typeof seoImage === 'string' && seoImage.trim() !== '') {
            // Use provided seoImage URL if no file uploaded
            seoImagePath = seoImage;
          }
        }
        
        // Prepare update data - only include valid Page interface fields
        const updateData: Partial<Omit<Page, 'id' | 'createdAt' | 'updatedAt'>> = {
          title: title.trim(),
          slug: newSlug, // Update slug (key) if changed
          content: content || '',
          status: (isActive ? 'published' : 'draft') as 'published' | 'draft',
          publishDate: publishDate || null,
          metaDescription: pageDescription || '',
          metaKeywords: pageKeywords || '',
          orderIndex: parseInt(menuSort) || 1000
        };
        if (description) updateData.description = description.trim().substring(0, 1000);
        if (pageImagePath && typeof pageImagePath === 'string' && pageImagePath.trim() !== '') {
          updateData.pageImage = pageImagePath;
        }
        if (seoImagePath && typeof seoImagePath === 'string' && seoImagePath.trim() !== '') {
          updateData.seoImage = seoImagePath;
        }
        
        // Get page ID from the existing page object
        const pageId = existingPage.id;
        
        if (!pageId) {
          // Transform page data to match template expectations
          const transformedPage = {
            ...existingPage,
            key: existingPage.slug,
            url: existingPage.slug,
            pageImage: existingPage.pageImage || '',
            seoImage: existingPage.seoImage || '',
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
            pageKey: pageKey,
            isCreateMode: false,
            error: 'Page ID not found. Cannot update page.'
          });
          return;
        }
        
        // Update page
        const updatedPage = await pagesService.updatePage(pageId, updateData);
        
        // If page key/slug changed, update menu items that reference this page
        let updatedMenuItems = 0;
        if (updatedPage && oldKey !== newSlug) {
          updatedMenuItems = await menuItemService.updateMenuItemsForPageKey(oldKey, newSlug);
          if (updatedMenuItems > 0) {
            console.log(`Updated ${updatedMenuItems} menu item(s) to reflect page key change from "${oldKey}" to "${newSlug}"`);
          }
        }
        
        // Handle tags - parse from JSON string or array
        if (pageTags) {
          let tagNames: string[] = [];
          if (typeof pageTags === 'string') {
            try {
              tagNames = JSON.parse(pageTags);
            } catch {
              // If not JSON, treat as comma-separated string
              tagNames = pageTags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
            }
          } else if (Array.isArray(pageTags)) {
            tagNames = pageTags.map((tag: string) => tag.trim()).filter((tag: string) => tag);
          }
          
          await pagesService.setPageTags(pageId, tagNames);
        }
        
        if (updatedPage) {
          // If key changed, redirect to new URL
          if (oldKey !== newSlug) {
            const successMessage = updatedMenuItems > 0 
              ? `Page updated successfully (${updatedMenuItems} menu item(s) updated)`
              : 'Page updated successfully';
            res.redirect(`/admin/pages/${newSlug}/edit?success=${encodeURIComponent(successMessage)}`);
          } else {
            res.redirect('/admin/pages?success=Page updated successfully');
          }
        } else {
          // Transform page data to match template expectations
          const transformedPage = {
            ...existingPage,
            key: existingPage.slug,
            url: existingPage.slug,
            pageImage: existingPage.pageImage || '',
            seoImage: existingPage.seoImage || '',
            seo: {
              pageTitle: existingPage.title || '',
              pageDescription: existingPage.metaDescription || '',
              pageKeywords: existingPage.metaKeywords || '',
              pageImage: existingPage.seoImage || existingPage.pageImage || ''
            }
          };
          
          res.render('pages/edit-page', {
            title: 'Edit Page',
            pageTitle: 'Edit Page',
            pageSubtitle: 'Update page content and settings',
            page: transformedPage,
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
      
      if (!existingPage) {
        res.redirect('/admin/pages?error=Page not found');
        return;
      }
      
      // Transform page data to match template expectations
      const transformedPage = {
        ...existingPage,
        key: existingPage.slug,
        url: existingPage.slug,
        seo: {
          pageTitle: existingPage.title || '',
          pageDescription: existingPage.metaDescription || '',
          pageKeywords: existingPage.metaKeywords || '',
          pageImage: existingPage.seoImage || existingPage.pageImage || ''
        }
      };
      
      res.render('pages/edit-page', {
        title: 'Edit Page',
        pageTitle: 'Edit Page',
        pageSubtitle: 'Update page content and settings',
        page: transformedPage,
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
      
      // Delete page folder and all its contents (including gallery photos)
      // Database will cascade delete photo records via foreign key or manual service delete
      const pageFolderPath = path.join(DATA_PATHS.PAGES_DIR, pageKey);
      try {
        storageService.deleteDirectory(pageFolderPath);
      } catch (fsError) {
        console.error('Error deleting page directory:', fsError);
        // Continue with DB delete even if file delete fails
      }
      
      // Delete page - use the page ID, not the key (slug)
      const deleted = await pagesService.deletePage(existingPage.id);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Page deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete page from database'
        });
      }
    } catch (error: any) {
      console.error('Error deleting page:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the page: ' + (error.message || 'Unknown error')
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
      
      const excludeKey = req.query.exclude as string | undefined;
      const existingPage = await pagesService.getPageByKey(key.trim());
      
      // If excludeKey is provided and matches the found page, treat it as not existing
      const exists = existingPage && (!excludeKey || existingPage.slug !== excludeKey);
      
      res.json({
        exists: !!exists,
        message: exists ? 'Page key already exists' : 'Page key is available'
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
      
      // Normalize URL - remove leading slash for slug comparison
      const normalizedUrl = url.trim().startsWith('/') ? url.trim().substring(1) : url.trim();
      
      const excludeUrl = req.query.exclude as string | undefined;
      // Normalize exclude URL too
      const normalizedExcludeUrl = excludeUrl ? (excludeUrl.startsWith('/') ? excludeUrl.substring(1) : excludeUrl) : undefined;
      
      const existingPage = await pagesService.getPageBySlug(normalizedUrl);
      
      // If excludeUrl is provided and matches the found page, treat it as not existing
      const exists = existingPage && (!normalizedExcludeUrl || existingPage.slug !== normalizedExcludeUrl);
      
      res.json({
        exists: !!exists,
        message: exists ? 'Page URL already exists' : 'Page URL is available'
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
      
      // Check if page has an image
      if (!existingPage.pageImage) {
        res.status(400).json({
          success: false,
          message: 'Page has no image to delete'
        });
        return;
      }
      
      // Delete the image file if it exists
      const imagePath = existingPage.pageImage || '';
      if (imagePath) {
        const fullImagePath = path.join(DATA_PATHS.PUBLIC_DIR, imagePath);
        storageService.deleteFile(fullImagePath);
      }
      
      // Update page to remove image reference
      // Note: With exactOptionalPropertyTypes, we can't set undefined, so we'll use an empty string
      const updateData: Partial<Omit<Page, 'id' | 'createdAt' | 'updatedAt'>> = {
        pageImage: ''
      };
      
      // Get page ID from existingPage
      const pageId = existingPage.id;
      if (!pageId) {
        res.status(400).json({
          success: false,
          message: 'Page ID not found'
        });
        return;
      }
      
      const updatedPage = await pagesService.updatePage(pageId, updateData);
      
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
      quillUpload.single('image')(req as any, res as any, async (err) => {
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

  /**
   * Upload photos for a page gallery
   */
  public static async uploadPagePhotos(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.status(400).json({ success: false, message: 'Page key is required' });
        return;
      }

      const page = await pagesService.getPageByKey(pageKey);
      if (!page) {
        res.status(404).json({ success: false, message: 'Page not found' });
        return;
      }

      // Handle multiple file uploads using gallery-specific upload config
      // Increased limit to 100 files for large batch uploads
      galleryUpload.array('photos', 100)(req as any, res as any, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          res.status(500).json({ success: false, message: err.message || 'File upload error occurred' });
          return;
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ success: false, message: 'No files uploaded' });
          return;
        }

        const uploadedPhotos: any[] = [];

        for (const file of files) {
          try {
            // File is already in the gallery directory with the correct filename
            // Get relative path for database
            const relativePath = path.relative(DATA_PATHS.PUBLIC_DIR, file.path);
            const dbPath = '/' + relativePath.replace(/\\/g, '/');

            // Save to database using the filename from multer
            const photo = await pagesService.addPagePhoto(page.id, file.filename, dbPath);
            if (photo) {
              uploadedPhotos.push({
                ...photo,
                url: dbPath
              });
            }
          } catch (error) {
            console.error('Error processing file:', file.originalname, error);
          }
        }

        res.json({
          success: true,
          message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
          photos: uploadedPhotos
        });
      });
    } catch (error) {
      console.error('Error uploading page photos:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while uploading photos'
      });
    }
  }

  /**
   * Get photos for a page
   */
  public static async getPagePhotos(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.status(400).json({ success: false, message: 'Page key is required' });
        return;
      }

      const page = await pagesService.getPageByKey(pageKey);
      if (!page) {
        res.status(404).json({ success: false, message: 'Page not found' });
        return;
      }

      const photos = await pagesService.getPagePhotos(page.id);
      res.json({
        success: true,
        photos: photos.map(photo => ({
          ...photo,
          url: photo.filePath
        }))
      });
    } catch (error) {
      console.error('Error getting page photos:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while getting page photos'
      });
    }
  }

  /**
   * Upload file for page content (for link modal in editor)
   * Saves files to page-specific directory
   */
  public static uploadPageFile: RequestHandler[] = [
    pageFileUpload.single('file') as unknown as RequestHandler,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const pageKey = req.params['key'] || req.body.key;
        if (!pageKey) {
          res.status(400).json({ success: false, error: 'Page key is required' });
          return;
        }

        if (!req.file) {
          res.status(400).json({ success: false, error: 'No file uploaded' });
          return;
        }

        const uploadedFile = req.file;

        // Validate file
        if (!uploadedFile.originalname || uploadedFile.size === 0) {
          res.status(400).json({ success: false, error: 'Invalid file' });
          return;
        }

        // Get relative path for public URL
        const relativePath = path.relative(DATA_PATHS.PUBLIC_DIR, uploadedFile.path);
        const publicPath = '/' + relativePath.replace(/\\/g, '/');
        
        res.json({ 
          success: true, 
          filePath: publicPath,
          fileName: uploadedFile.filename,
          originalName: uploadedFile.originalname
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, error: 'Failed to upload file' });
      }
    }
  ];

  /**
   * Delete a page gallery photo
   */
  public static async deletePageGalleryPhoto(req: Request, res: Response): Promise<void> {
    try {
      const photoId = parseInt(req.params['photoId']);
      if (!photoId || isNaN(photoId)) {
        res.status(400).json({ success: false, message: 'Valid photo ID is required' });
        return;
      }

      // Get photo info before deleting from database
      const pageKey = req.params['key'];
      const page = await pagesService.getPageByKey(pageKey);
      if (!page) {
        res.status(404).json({ success: false, message: 'Page not found' });
        return;
      }

      const photos = await pagesService.getPagePhotos(page.id);
      const photo = photos.find(p => p.id === photoId);
      
      if (!photo) {
        res.status(404).json({ success: false, message: 'Photo not found' });
        return;
      }

      deleteThumbFileForSourceImageUrl(photo.filePath);
      // Delete file from filesystem
      const filePath = path.join(DATA_PATHS.PUBLIC_DIR, photo.filePath.substring(1));
      storageService.deleteFile(filePath);

      // Delete from database
      const deleted = await pagesService.deletePagePhoto(photoId);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Photo deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete photo from database'
        });
      }
    } catch (error) {
      console.error('Error deleting page photo:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the photo'
      });
    }
  }

  /**
   * Reorder page photos
   */
  public static async reorderPagePhotos(req: Request, res: Response): Promise<void> {
    try {
      const pageKey = req.params['key'];
      if (!pageKey) {
        res.status(400).json({ success: false, message: 'Page key is required' });
        return;
      }

      const page = await pagesService.getPageByKey(pageKey);
      if (!page) {
        res.status(404).json({ success: false, message: 'Page not found' });
        return;
      }

      const { photoOrders } = req.body;
      if (!Array.isArray(photoOrders)) {
        res.status(400).json({ success: false, message: 'Invalid photo orders format' });
        return;
      }

      const success = await pagesService.reorderPagePhotos(page.id, photoOrders);
      
      if (success) {
        res.json({
          success: true,
          message: 'Photos reordered successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to reorder photos'
        });
      }
    } catch (error) {
      console.error('Error reordering page photos:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while reordering photos'
      });
    }
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