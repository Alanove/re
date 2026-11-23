"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const adminMenuService_1 = require("../services/adminMenuService");
const pagesService_1 = require("../services/pagesService");
const menuService_1 = require("../services/menuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const storageService_1 = require("../services/storageService");
const videoEmbedService_1 = require("../services/videoEmbedService");
const constants_1 = require("../../src/constants");
const securityService_1 = __importDefault(require("../../src/services/securityService"));
const imageThumbService_1 = require("../../src/services/imageThumbService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const pagesService = pagesService_1.PagesService.getInstance();
const menuItemService = menuService_1.MenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
const upload = storageService.createPageUploadConfig();
const quillUpload = storageService.createQuillUploadConfig();
const galleryUpload = storageService.createPageGalleryUploadConfig();
const pageFileUpload = storageService.createPageFileUploadConfig();
class PagesController {
    static async pages(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 20;
            const keyword = req.query.keyword || '';
            const status = req.query.status || '';
            const tag = (req.query.tag || '').trim();
            const paginationOptions = {
                page,
                itemsPerPage
            };
            if (keyword)
                paginationOptions.keyword = keyword;
            if (status)
                paginationOptions.status = status;
            if (tag)
                paginationOptions.tag = tag;
            const result = await pagesService.getPagesWithPagination(paginationOptions);
            const allTags = await pagesService.getAllTags();
            const siteTitle = await siteSettingsService.getSiteTitle();
            const totalPages = Math.ceil(result.total / itemsPerPage);
            const startIndex = result.total > 0 ? (page - 1) * itemsPerPage + 1 : 0;
            const endIndex = Math.min(page * itemsPerPage, result.total);
            const buildPaginationUrl = (pageNum) => {
                const params = new URLSearchParams();
                if (keyword)
                    params.set('keyword', keyword);
                if (status)
                    params.set('status', status);
                if (tag)
                    params.set('tag', tag);
                params.set('page', pageNum.toString());
                params.set('itemsPerPage', itemsPerPage.toString());
                return `/admin/pages?${params.toString()}`;
            };
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
                currentPage: page,
                itemsPerPage: itemsPerPage,
                totalPages: totalPages,
                totalItems: result.total,
                startIndex: startIndex,
                endIndex: endIndex,
                currentKeyword: keyword,
                currentStatus: status,
                currentTag: tag,
                buildPaginationUrl: buildPaginationUrl
            });
        }
        catch (error) {
            console.error('Error rendering pages:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async tags(req, res) {
        try {
            const allTags = await pagesService.getAllTags();
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
        }
        catch (error) {
            console.error('Error rendering tags:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createPage(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
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
            const pageCSS = '';
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
        }
        catch (error) {
            console.error('Error rendering create page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createPagePost(req, res) {
        try {
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
                try {
                    const originalBody = req.body;
                    req.body = { ...req.body, _csrf: csrfToken };
                    await new Promise((resolve, reject) => {
                        securityService_1.default.csrfProtection(req, res, (err) => {
                            req.body = originalBody;
                            if (err && err.code === 'EBADCSRFTOKEN') {
                                reject(new Error('Invalid CSRF token'));
                            }
                            else if (err) {
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    });
                }
                catch (csrfErr) {
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
                const pageImage = Array.isArray(pageImageRaw) ? pageImageRaw[0] || '' : (pageImageRaw || '');
                let seoImage = Array.isArray(seoImageRaw) ? seoImageRaw[0] || '' : (seoImageRaw || '');
                if (seoImageUrl && typeof seoImageUrl === 'string' && seoImageUrl.trim() !== '') {
                    seoImage = seoImageUrl.trim();
                }
                else if (Array.isArray(seoImageUrl) && seoImageUrl.length > 0 && seoImageUrl[0]) {
                    seoImage = seoImageUrl[0].trim();
                }
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
                let pageImagePath = '';
                let seoImagePath = '';
                const files = req.files;
                if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
                    pageImagePath = `/pages/${key.trim()}/${files['pagePicture'][0].filename}`;
                }
                else if (pageImage) {
                    pageImagePath = pageImage;
                }
                if (usePageImage === '1') {
                    seoImagePath = pageImagePath;
                }
                else {
                    if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
                        seoImagePath = `/pages/${key.trim()}/${files['seoImageFile'][0].filename}`;
                    }
                    else if (seoImage) {
                        seoImagePath = seoImage;
                    }
                }
                let tagNames = [];
                if (pageTags) {
                    if (typeof pageTags === 'string') {
                        try {
                            tagNames = JSON.parse(pageTags);
                        }
                        catch {
                            tagNames = pageTags.split(',').map((tag) => tag.trim()).filter((tag) => tag);
                        }
                    }
                    else if (Array.isArray(pageTags)) {
                        tagNames = pageTags.map((tag) => tag.trim()).filter((tag) => tag);
                    }
                }
                const pageData = {
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
                if (description)
                    pageData.description = description.trim().substring(0, 1000);
                if (pageImagePath)
                    pageData.pageImage = pageImagePath;
                if (seoImagePath)
                    pageData.seoImage = seoImagePath;
                if (tagNames.length > 0)
                    pageData.tags = tagNames;
                const newPage = await pagesService.createPage(pageData);
                if (newPage) {
                    res.redirect('/admin/pages?success=Page created successfully');
                }
                else {
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
        }
        catch (error) {
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
    static async editPage(req, res) {
        try {
            const pageKey = req.params['key'];
            if (!pageKey) {
                return res.redirect('/admin/pages?error=Page key is required');
            }
            if (pageKey === '-1') {
                return res.redirect('/admin/pages/create');
            }
            const page = await pagesService.getPageByKey(pageKey);
            console.log('Debug - pageKey:', pageKey);
            console.log('Debug - page found:', page);
            if (!page) {
                return res.redirect('/admin/pages?error=Page not found');
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const pageCSS = '';
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
            const allTags = await pagesService.getAllTags();
            const transformedPage = {
                ...page,
                key: page.slug,
                url: page.slug,
                pageImage: page.pageImage || '',
                seoImage: page.seoImage || '',
                publishDate: page.publishDate || '',
                tags: page.tags || [],
                seo: {
                    pageTitle: page.title || '',
                    pageDescription: page.metaDescription || '',
                    pageKeywords: page.metaKeywords || '',
                    pageImage: page.seoImage || page.pageImage || ''
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
        }
        catch (error) {
            console.error('Error rendering edit page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async editPagePost(req, res) {
        try {
            const pageKey = req.params['key'];
            if (!pageKey) {
                res.redirect('/admin/pages?error=Page key is required');
                return;
            }
            upload.fields([
                { name: 'pagePicture', maxCount: 1 },
                { name: 'seoImageFile', maxCount: 1 }
            ])(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    const existingPage = await pagesService.getPageByKey(pageKey);
                    if (!existingPage) {
                        res.redirect('/admin/pages?error=Page not found');
                        return;
                    }
                }
                const csrfToken = req.body?._csrf;
                if (!csrfToken) {
                    console.error('CSRF token missing in form data after multer processing');
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
                        error: 'Security token missing. Please refresh the page and try again.'
                    });
                }
                try {
                    const originalBody = req.body;
                    req.body = { ...req.body, _csrf: csrfToken };
                    await new Promise((resolve, reject) => {
                        securityService_1.default.csrfProtection(req, res, (err) => {
                            req.body = originalBody;
                            if (err && err.code === 'EBADCSRFTOKEN') {
                                reject(new Error('Invalid CSRF token'));
                            }
                            else if (err) {
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    });
                }
                catch (csrfErr) {
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
                if (err) {
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
                const pageImage = Array.isArray(pageImageRaw) ? pageImageRaw[0] || '' : (pageImageRaw || '');
                let seoImage = Array.isArray(seoImageRaw) ? seoImageRaw[0] || '' : (seoImageRaw || '');
                if (seoImageUrl && typeof seoImageUrl === 'string' && seoImageUrl.trim() !== '') {
                    seoImage = seoImageUrl.trim();
                }
                else if (Array.isArray(seoImageUrl) && seoImageUrl.length > 0 && seoImageUrl[0]) {
                    seoImage = seoImageUrl[0].trim();
                }
                console.log('Edit page form submission:');
                console.log('Files:', req.files);
                console.log('Body keys:', Object.keys(req.body));
                const existingPage = await pagesService.getPageByKey(pageKey);
                if (!existingPage) {
                    res.redirect('/admin/pages?error=Page not found');
                    return;
                }
                if (!title || title.trim() === '') {
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
                const newKey = key ? key.trim() : existingPage.slug;
                const newUrl = url ? url.trim() : existingPage.slug;
                const normalizedKey = newKey.startsWith('/') ? newKey.substring(1) : newKey;
                const normalizedUrl = newUrl.startsWith('/') ? newUrl : '/' + newUrl;
                const urlSlug = normalizedUrl.startsWith('/') ? normalizedUrl.substring(1) : normalizedUrl;
                if (normalizedKey !== urlSlug) {
                    console.warn(`Key (${normalizedKey}) and URL slug (${urlSlug}) don't match. Using key as slug.`);
                }
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
                let pageImagePath = existingPage.pageImage || null;
                let seoImagePath = existingPage.seoImage || null;
                const oldKey = existingPage.slug;
                const newSlug = normalizedKey;
                let folderRenamed = false;
                if (oldKey !== newSlug) {
                    const oldFolderPath = path_1.default.join(constants_1.DATA_PATHS.PAGES_DIR, oldKey);
                    const newFolderPath = path_1.default.join(constants_1.DATA_PATHS.PAGES_DIR, newSlug);
                    if (fs_1.default.existsSync(oldFolderPath)) {
                        try {
                            fs_1.default.renameSync(oldFolderPath, newFolderPath);
                            folderRenamed = true;
                            console.log(`Renamed page folder from ${oldKey} to ${newSlug}`);
                            if (existingPage.pageImage && existingPage.pageImage.includes(`/pages/${oldKey}/`)) {
                                pageImagePath = existingPage.pageImage.replace(`/pages/${oldKey}/`, `/pages/${newSlug}/`);
                            }
                            if (existingPage.seoImage && existingPage.seoImage.includes(`/pages/${oldKey}/`)) {
                                seoImagePath = existingPage.seoImage.replace(`/pages/${oldKey}/`, `/pages/${newSlug}/`);
                            }
                        }
                        catch (error) {
                            console.error('Error renaming page folder:', error);
                        }
                    }
                }
                const files = req.files;
                if (files?.['pagePicture'] && files['pagePicture'].length > 0 && files['pagePicture'][0]?.filename) {
                    pageImagePath = `/pages/${newSlug}/${files['pagePicture'][0].filename}`;
                    console.log('New page image uploaded:', pageImagePath);
                }
                if (usePageImage === '1') {
                    seoImagePath = pageImagePath;
                    console.log('Using page image for SEO:', seoImagePath);
                }
                else {
                    if (files?.['seoImageFile'] && files['seoImageFile'].length > 0 && files['seoImageFile'][0]?.filename) {
                        seoImagePath = `/pages/${newSlug}/${files['seoImageFile'][0].filename}`;
                        console.log('New SEO image uploaded:', seoImagePath);
                    }
                    else if (seoImage && typeof seoImage === 'string' && seoImage.trim() !== '') {
                        seoImagePath = seoImage;
                    }
                }
                const updateData = {
                    title: title.trim(),
                    slug: newSlug,
                    content: content || '',
                    status: (isActive ? 'published' : 'draft'),
                    publishDate: publishDate || null,
                    metaDescription: pageDescription || '',
                    metaKeywords: pageKeywords || '',
                    orderIndex: parseInt(menuSort) || 1000
                };
                if (description)
                    updateData.description = description.trim().substring(0, 1000);
                if (pageImagePath && typeof pageImagePath === 'string' && pageImagePath.trim() !== '') {
                    updateData.pageImage = pageImagePath;
                }
                if (seoImagePath && typeof seoImagePath === 'string' && seoImagePath.trim() !== '') {
                    updateData.seoImage = seoImagePath;
                }
                const pageId = existingPage.id;
                if (!pageId) {
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
                const updatedPage = await pagesService.updatePage(pageId, updateData);
                let updatedMenuItems = 0;
                if (updatedPage && oldKey !== newSlug) {
                    updatedMenuItems = await menuItemService.updateMenuItemsForPageKey(oldKey, newSlug);
                    if (updatedMenuItems > 0) {
                        console.log(`Updated ${updatedMenuItems} menu item(s) to reflect page key change from "${oldKey}" to "${newSlug}"`);
                    }
                }
                if (pageTags) {
                    let tagNames = [];
                    if (typeof pageTags === 'string') {
                        try {
                            tagNames = JSON.parse(pageTags);
                        }
                        catch {
                            tagNames = pageTags.split(',').map((tag) => tag.trim()).filter((tag) => tag);
                        }
                    }
                    else if (Array.isArray(pageTags)) {
                        tagNames = pageTags.map((tag) => tag.trim()).filter((tag) => tag);
                    }
                    await pagesService.setPageTags(pageId, tagNames);
                }
                if (updatedPage) {
                    if (oldKey !== newSlug) {
                        const successMessage = updatedMenuItems > 0
                            ? `Page updated successfully (${updatedMenuItems} menu item(s) updated)`
                            : 'Page updated successfully';
                        res.redirect(`/admin/pages/${newSlug}/edit?success=${encodeURIComponent(successMessage)}`);
                    }
                    else {
                        res.redirect('/admin/pages?success=Page updated successfully');
                    }
                }
                else {
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
        }
        catch (error) {
            console.error('Error updating page:', error);
            const pageKey = req.params['key'];
            const existingPage = pageKey ? await pagesService.getPageByKey(pageKey) : null;
            if (!existingPage) {
                res.redirect('/admin/pages?error=Page not found');
                return;
            }
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
    static async deletePage(req, res) {
        try {
            const pageKey = req.params['key'];
            if (!pageKey) {
                res.status(400).json({
                    success: false,
                    message: 'Page key is required'
                });
                return;
            }
            const existingPage = await pagesService.getPageByKey(pageKey);
            if (!existingPage) {
                res.status(404).json({
                    success: false,
                    message: 'Page not found'
                });
                return;
            }
            const pageFolderPath = path_1.default.join(constants_1.DATA_PATHS.PAGES_DIR, pageKey);
            try {
                storageService.deleteDirectory(pageFolderPath);
            }
            catch (fsError) {
                console.error('Error deleting page directory:', fsError);
            }
            const deleted = await pagesService.deletePage(existingPage.id);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Page deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete page from database'
                });
            }
        }
        catch (error) {
            console.error('Error deleting page:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the page: ' + (error.message || 'Unknown error')
            });
        }
    }
    static async checkPageKey(req, res) {
        try {
            const key = req.params['key'];
            if (!key) {
                res.status(400).json({
                    exists: false,
                    message: 'Key parameter is required'
                });
                return;
            }
            const excludeKey = req.query.exclude;
            const existingPage = await pagesService.getPageByKey(key.trim());
            const exists = existingPage && (!excludeKey || existingPage.slug !== excludeKey);
            res.json({
                exists: !!exists,
                message: exists ? 'Page key already exists' : 'Page key is available'
            });
        }
        catch (error) {
            console.error('Error checking page key:', error);
            res.status(500).json({
                exists: false,
                message: 'An error occurred while checking the page key'
            });
        }
    }
    static async checkPageUrl(req, res) {
        try {
            const url = req.params['url'];
            if (!url) {
                res.status(400).json({
                    exists: false,
                    message: 'URL parameter is required'
                });
                return;
            }
            const normalizedUrl = url.trim().startsWith('/') ? url.trim().substring(1) : url.trim();
            const excludeUrl = req.query.exclude;
            const normalizedExcludeUrl = excludeUrl ? (excludeUrl.startsWith('/') ? excludeUrl.substring(1) : excludeUrl) : undefined;
            const existingPage = await pagesService.getPageBySlug(normalizedUrl);
            const exists = existingPage && (!normalizedExcludeUrl || existingPage.slug !== normalizedExcludeUrl);
            res.json({
                exists: !!exists,
                message: exists ? 'Page URL already exists' : 'Page URL is available'
            });
        }
        catch (error) {
            console.error('Error checking page URL:', error);
            res.status(500).json({
                exists: false,
                message: 'An error occurred while checking the page URL'
            });
        }
    }
    static async deletePageImage(req, res) {
        try {
            const pageKey = req.params['key'];
            if (!pageKey) {
                res.status(400).json({
                    success: false,
                    message: 'Page key is required'
                });
                return;
            }
            const existingPage = await pagesService.getPageByKey(pageKey);
            if (!existingPage) {
                res.status(404).json({
                    success: false,
                    message: 'Page not found'
                });
                return;
            }
            if (!existingPage.pageImage) {
                res.status(400).json({
                    success: false,
                    message: 'Page has no image to delete'
                });
                return;
            }
            const imagePath = existingPage.pageImage || '';
            if (imagePath) {
                const fullImagePath = path_1.default.join(constants_1.DATA_PATHS.PUBLIC_DIR, imagePath);
                storageService.deleteFile(fullImagePath);
            }
            const updateData = {
                pageImage: ''
            };
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
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete page image'
                });
            }
        }
        catch (error) {
            console.error('Error deleting page image:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the page image'
            });
        }
    }
    static async uploadImage(req, res) {
        try {
            console.log('Upload image request received:');
            console.log('Query:', req.query);
            quillUpload.single('image')(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    res.status(400).json({
                        success: false,
                        message: err.message || 'File upload error occurred.'
                    });
                    return;
                }
                console.log('Body after multer:', req.body);
                console.log('Files after multer:', req.files);
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
                    const genericDir = path_1.default.join(constants_1.DATA_PATHS.IMAGES_DIR, 'generic');
                    if (!fs_1.default.existsSync(genericDir)) {
                        fs_1.default.mkdirSync(genericDir, { recursive: true });
                    }
                    const filename = storageService.generateEditorFilename(file.originalname);
                    const newFilePath = path_1.default.join(genericDir, filename);
                    storageService.moveFile(file.path, newFilePath);
                    const imageUrl = storageService.getPublicUrl(newFilePath);
                    console.log('Generic image uploaded successfully:', imageUrl);
                    res.json({
                        success: true,
                        url: imageUrl,
                        message: 'Image uploaded successfully to generic location'
                    });
                    return;
                }
                const filename = storageService.generateEditorFilename(file.originalname);
                const pageEditorDir = storageService.createPageEditorDirectory(pageKey);
                const newFilePath = path_1.default.join(pageEditorDir, filename);
                storageService.moveFile(file.path, newFilePath);
                const imageUrl = storageService.getPublicUrl(newFilePath);
                console.log('Image uploaded successfully:', imageUrl);
                res.json({
                    success: true,
                    url: imageUrl,
                    message: 'Image uploaded successfully'
                });
            });
        }
        catch (error) {
            console.error('Error uploading image:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while uploading the image'
            });
        }
    }
    static async getPageImages(req, res) {
        try {
            const pageKey = req.query.pageKey;
            if (!pageKey || pageKey === 'generic') {
                const genericDir = path_1.default.join(constants_1.DATA_PATHS.IMAGES_DIR, 'generic');
                const images = _a.getImagesFromDirectory(genericDir);
                res.json({ success: true, images });
                return;
            }
            const pageEditorDir = path_1.default.join(constants_1.DATA_PATHS.PAGES_DIR, pageKey, 'editor');
            const images = _a.getImagesFromDirectory(pageEditorDir);
            res.json({ success: true, images });
        }
        catch (error) {
            console.error('Error getting page images:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while getting page images'
            });
        }
    }
    static async getPublicImages(req, res) {
        try {
            const images = [];
            const publicImagesDir = constants_1.DATA_PATHS.IMAGES_DIR;
            const publicImages = _a.getImagesFromDirectory(publicImagesDir);
            images.push(...publicImages);
            const genericDir = path_1.default.join(constants_1.DATA_PATHS.IMAGES_DIR, 'generic');
            const genericImages = _a.getImagesFromDirectory(genericDir);
            images.push(...genericImages);
            const slideDir = constants_1.DATA_PATHS.SLIDER_DIR;
            const slideImages = _a.getImagesFromDirectory(slideDir);
            images.push(...slideImages);
            res.json({ success: true, images });
        }
        catch (error) {
            console.error('Error getting public images:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while getting public images'
            });
        }
    }
    static getImagesFromDirectory(dirPath) {
        const images = [];
        if (!fs_1.default.existsSync(dirPath)) {
            return images;
        }
        try {
            const files = fs_1.default.readdirSync(dirPath);
            files.forEach(file => {
                const filePath = path_1.default.join(dirPath, file);
                const stats = fs_1.default.statSync(filePath);
                if (stats.isFile()) {
                    const ext = path_1.default.extname(file).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                        const relativePath = path_1.default.relative(constants_1.DATA_PATHS.PUBLIC_DIR, filePath);
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
        }
        catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
        return images;
    }
    static async uploadPagePhotos(req, res) {
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
            galleryUpload.array('photos', 100)(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    res.status(500).json({ success: false, message: err.message || 'File upload error occurred' });
                    return;
                }
                const files = req.files;
                if (!files || files.length === 0) {
                    res.status(400).json({ success: false, message: 'No files uploaded' });
                    return;
                }
                const uploadedPhotos = [];
                for (const file of files) {
                    try {
                        const relativePath = path_1.default.relative(constants_1.DATA_PATHS.PUBLIC_DIR, file.path);
                        const dbPath = '/' + relativePath.replace(/\\/g, '/');
                        const photo = await pagesService.addPagePhoto(page.id, file.filename, dbPath);
                        if (photo) {
                            uploadedPhotos.push({
                                ...photo,
                                url: dbPath
                            });
                        }
                    }
                    catch (error) {
                        console.error('Error processing file:', file.originalname, error);
                    }
                }
                res.json({
                    success: true,
                    message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
                    photos: uploadedPhotos
                });
            });
        }
        catch (error) {
            console.error('Error uploading page photos:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while uploading photos'
            });
        }
    }
    static async getPagePhotos(req, res) {
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
        }
        catch (error) {
            console.error('Error getting page photos:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while getting page photos'
            });
        }
    }
    static async deletePageGalleryPhoto(req, res) {
        try {
            const photoId = parseInt(req.params['photoId']);
            if (!photoId || isNaN(photoId)) {
                res.status(400).json({ success: false, message: 'Valid photo ID is required' });
                return;
            }
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
            (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(photo.filePath);
            const filePath = path_1.default.join(constants_1.DATA_PATHS.PUBLIC_DIR, photo.filePath.substring(1));
            storageService.deleteFile(filePath);
            const deleted = await pagesService.deletePagePhoto(photoId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Photo deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete photo from database'
                });
            }
        }
        catch (error) {
            console.error('Error deleting page photo:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the photo'
            });
        }
    }
    static async reorderPagePhotos(req, res) {
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
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to reorder photos'
                });
            }
        }
        catch (error) {
            console.error('Error reordering page photos:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while reordering photos'
            });
        }
    }
    static async fetchVideoEmbed(req, res) {
        try {
            const { url } = req.body;
            if (!url || typeof url !== 'string') {
                res.status(400).json({
                    success: false,
                    message: 'Video URL is required'
                });
                return;
            }
            const videoData = await videoEmbedService_1.videoEmbedService.fetchVideoMetadata(url);
            if (!videoData) {
                res.status(400).json({
                    success: false,
                    message: 'Could not fetch video information. Please ensure the URL is from YouTube, Vimeo, or Rutube.'
                });
                return;
            }
            const newCsrfToken = req.csrfToken ? req.csrfToken() : '';
            res.json({
                success: true,
                csrfToken: newCsrfToken,
                ...videoData
            });
        }
        catch (error) {
            console.error('Error fetching video embed:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while fetching video information'
            });
        }
    }
}
exports.PagesController = PagesController;
_a = PagesController;
PagesController.uploadPageFile = [
    pageFileUpload.single('file'),
    async (req, res) => {
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
            if (!uploadedFile.originalname || uploadedFile.size === 0) {
                res.status(400).json({ success: false, error: 'Invalid file' });
                return;
            }
            const relativePath = path_1.default.relative(constants_1.DATA_PATHS.PUBLIC_DIR, uploadedFile.path);
            const publicPath = '/' + relativePath.replace(/\\/g, '/');
            res.json({
                success: true,
                filePath: publicPath,
                fileName: uploadedFile.filename,
                originalName: uploadedFile.originalname
            });
        }
        catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ success: false, error: 'Failed to upload file' });
        }
    }
];
//# sourceMappingURL=pagesController.js.map