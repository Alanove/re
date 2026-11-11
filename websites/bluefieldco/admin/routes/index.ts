import { Router } from 'express';
// Initialize router early to avoid ReferenceError when defining routes before declaration
const router = Router();

import { AdminController } from '../controllers/adminController';
import { DashboardController } from '../controllers/dashboardController';
import { UsersController } from '../controllers/usersController';
import { PagesController } from '../controllers/pagesController';
import { NewsController } from '../controllers/newsController';
import { SliderController } from '../controllers/sliderController';
import { ProfileController } from '../controllers/profileController';
import { ThemeController } from '../controllers/themeController';
import { SiteSettingsController } from '../controllers/siteSettingsController';
import { MenuController } from '../controllers/menuController';
import { ContactInfoController } from '../controllers/contactInfoController';
import { StorageService } from '../services/storageService';

// Initialize storage service for multer configurations
const storageService = StorageService.getInstance();
const sliderUpload = storageService.createSliderUploadConfig();

// Authentication routes (no auth required)
router.get('/login', AdminController.login);
router.post('/login', AdminController.loginPost);

// Dashboard
router.get('/dashboard', AdminController.requireAuth, DashboardController.dashboard);
router.get('/dashboard/data', AdminController.requireAuth, DashboardController.dashboardData);

// Profile management
router.get('/profile', AdminController.requireAuth, ProfileController.profile);
router.post('/profile/edit', AdminController.requireAuth, ProfileController.editProfilePost);

// Users management
router.get('/users', AdminController.requireAuth, UsersController.users);
router.get('/users/create', AdminController.requireAuth, UsersController.createUser);
router.post('/users/create', AdminController.requireAuth, UsersController.createUserPost);
router.get('/users/:id/edit', AdminController.requireAuth, UsersController.editUser);
router.post('/users/:id/edit', AdminController.requireAuth, UsersController.editUserPost);
router.delete('/users/:id', AdminController.requireAuth, UsersController.deleteUser);

// Pages management
router.get('/pages', AdminController.requireAuth, PagesController.pages);
router.get('/pages/create', AdminController.requireAuth, PagesController.createPage);
router.post('/pages/create', AdminController.requireAuth, PagesController.createPagePost);
router.get('/pages/:key/edit', AdminController.requireAuth, PagesController.editPage);
router.post('/pages/:key/edit', AdminController.requireAuth, PagesController.editPagePost);
router.delete('/pages/:key', AdminController.requireAuth, PagesController.deletePage);
router.delete('/pages/:key/delete-image', AdminController.requireAuth, PagesController.deletePageImage);
router.post('/pages/:key/upload-file', AdminController.requireAuth, PagesController.uploadFile);

// Pages API endpoints for validation
router.get('/api/pages/check-key/:key', AdminController.requireAuth, PagesController.checkPageKey);
router.get('/api/pages/check-url/:url', AdminController.requireAuth, PagesController.checkPageUrl);
router.post('/api/upload-image', AdminController.requireApiAuth, PagesController.uploadImage);

// Image management API endpoints
router.get('/api/page-images', AdminController.requireApiAuth, PagesController.getPageImages);
router.get('/api/public-images', AdminController.requireApiAuth, PagesController.getPublicImages);

// Video embed API endpoint
router.post('/api/video/embed', AdminController.requireApiAuth, PagesController.fetchVideoEmbed);

// News management
router.get('/news', AdminController.requireAuth, NewsController.news);
router.get('/news/create', AdminController.requireAuth, NewsController.createNews);
router.post('/news/create', AdminController.requireAuth, NewsController.createNewsPost);
router.get('/news/:key/edit', AdminController.requireAuth, NewsController.editNews);
router.post('/news/:key/edit', AdminController.requireAuth, NewsController.editNewsPost);
router.delete('/news/:key', AdminController.requireAuth, NewsController.deleteNews);
router.delete('/news/:key/delete-image', AdminController.requireAuth, NewsController.deleteNewsImage);

// News API endpoints for validation
router.get('/api/news/check-key/:key', AdminController.requireAuth, NewsController.checkPageKey);
router.get('/api/news/check-url/:url', AdminController.requireAuth, NewsController.checkPageUrl);

// Slider management
router.get('/slider', AdminController.requireAuth, SliderController.slider);
router.get('/slider/create', AdminController.requireAuth, SliderController.createSlide);
router.post('/slider/create', AdminController.requireAuth, sliderUpload.single('image'), SliderController.createSlidePost);
router.get('/slider/:id/edit', AdminController.requireAuth, SliderController.editSlide);
router.post('/slider/:id/edit', AdminController.requireAuth, sliderUpload.single('image'), SliderController.editSlidePost);
router.delete('/slider/:id', AdminController.requireAuth, SliderController.deleteSlide);
router.get('/slider/:id/move-up', AdminController.requireAuth, SliderController.moveSlideUp);
router.get('/slider/:id/move-down', AdminController.requireAuth, SliderController.moveSlideDown);
router.get('/slider/:id/toggle-active', AdminController.requireAuth, SliderController.toggleSlideActive);
router.post('/api/slider/upload-image', AdminController.requireAuth, SliderController.uploadImage);

// Site settings management
router.get('/site-settings', AdminController.requireAuth, SiteSettingsController.siteSettings);
router.post('/site-settings/update', AdminController.requireAuth, SiteSettingsController.updateSettings);
router.post('/site-settings/test-upload', AdminController.requireAuth, SiteSettingsController.testUpload);
router.delete('/site-settings/delete-image/:type', AdminController.requireAuth, SiteSettingsController.deleteSiteImage);

// Contact info management (office locations)
router.get('/api/contact-info', AdminController.requireAuth, ContactInfoController.getAll);
router.post('/api/contact-info', AdminController.requireAuth, ContactInfoController.add);
router.put('/api/contact-info/:id', AdminController.requireAuth, ContactInfoController.update);
router.delete('/api/contact-info/:id', AdminController.requireAuth, ContactInfoController.delete);

// Menu management
router.get('/menus', AdminController.requireAuth, MenuController.menus);
router.get('/menus/create', AdminController.requireAuth, MenuController.createMenu);
router.post('/menus/create', AdminController.requireAuth, MenuController.createMenuPost);
router.get('/menus/:id/edit', AdminController.requireAuth, MenuController.editMenu);
router.post('/menus/:id/edit', AdminController.requireAuth, MenuController.editMenuPost);
router.delete('/menus/:id', AdminController.requireAuth, MenuController.deleteMenu);

// Menu items management (AJAX endpoints)
router.post('/menus/:menuId/items', AdminController.requireAuth, MenuController.addMenuItem);
router.put('/menus/:menuId/items/:itemId', AdminController.requireAuth, MenuController.updateMenuItem);
router.delete('/menus/:menuId/items/:itemId', AdminController.requireAuth, MenuController.deleteMenuItem);
router.post('/menus/:menuId/items/:itemId/move', AdminController.requireAuth, MenuController.moveMenuItem);
router.get('/menus/:menuId/items', AdminController.requireAuth, MenuController.getMenuItems);
router.get('/api/pages', AdminController.requireAuth, MenuController.getPages);
router.post('/admin/upload-file', AdminController.requireAuth, MenuController.uploadFile);

// Theme management API routes
router.get('/theme', AdminController.requireAuth, ThemeController.themeManagement);
router.get('/api/theme', AdminController.requireAuth, ThemeController.getCurrentTheme);
router.post('/api/theme', AdminController.requireAuth, ThemeController.setTheme);
router.post('/api/theme/toggle-dark-mode', AdminController.requireAuth, ThemeController.toggleDarkMode);
router.post('/api/theme/dark-mode', AdminController.requireAuth, ThemeController.setDarkMode);
router.post('/api/theme/reset', AdminController.requireAuth, ThemeController.resetTheme);
router.get('/api/theme/available', AdminController.requireAuth, ThemeController.getAvailableThemes);
router.get('/api/theme/export', AdminController.requireAuth, ThemeController.exportTheme);
router.post('/api/theme/import', AdminController.requireAuth, ThemeController.importTheme);
router.get('/api/theme/variables', AdminController.requireAuth, ThemeController.getThemeVariables);

// Logout
router.get('/logout', AdminController.logout);

export default router; 