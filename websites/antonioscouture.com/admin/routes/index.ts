import { Router, RequestHandler } from 'express';
// Initialize router early to avoid ReferenceError when defining routes before declaration
const router = Router();

import { AdminController } from '../controllers/adminController';
import { DashboardController } from '../controllers/dashboardController';
import { UsersController } from '../controllers/usersController';
import { PagesController } from '../controllers/pagesController';
import { SliderController } from '../controllers/sliderController';
import { ProjectsController } from '../controllers/projectsController';
import { ProfileController } from '../controllers/profileController';
import { ThemeController } from '../controllers/themeController';
import { SiteSettingsController } from '../controllers/siteSettingsController';
import { ContactSettingsController } from '../controllers/contactSettingsController';
import { IntegrationSettingsController } from '../controllers/integrationSettingsController';
import { MenuController } from '../controllers/menuController';
import { EmailTemplatesController } from '../controllers/emailTemplatesController';
import { ProductsController } from '../controllers/productsController';
import { OrdersController } from '../controllers/ordersController';
import { ShipmentsController } from '../controllers/shipmentsController';
import { DiscountsController } from '../controllers/discountsController';
import { CategoriesController } from '../controllers/categoriesController';
import { CustomersController } from '../controllers/customersController';
import { EcommerceSettingsController } from '../controllers/ecommerceSettingsController';
import { ReportsController } from '../controllers/reportsController';
import { ProductAttributesController } from '../controllers/productAttributesController';
import { BrandsController } from '../controllers/brandsController';
import { NewsletterController } from '../controllers/newsletterController';
import { ReviewsController } from '../controllers/reviewsController';
import { HomeContentController } from '../controllers/homeContentController';
import { ChatController } from '../controllers/chatController';
import { StorageService } from '../services/storageService';
import { requireAdminAccess, requireRole } from '../utils/roleMiddleware';

// Initialize storage service for multer configurations
const storageService = StorageService.getInstance();
const sliderUpload = storageService.createSliderUploadConfig();
const categoryMediaUpload = storageService.createCategoryUploadConfig();

// Authentication routes (no auth required)
router.get('/login', AdminController.login);
router.post('/login', AdminController.loginPost);

// Dashboard - accessible by all admin roles except Member
router.get('/dashboard', AdminController.requireAuth, requireAdminAccess(), DashboardController.dashboardEcommerce);
router.get('/dashboard/cms', AdminController.requireAuth, requireAdminAccess(), DashboardController.dashboardCms);
router.get('/dashboard/cms/data', AdminController.requireAuth, requireAdminAccess(), DashboardController.dashboardData);

// Profile management - accessible by all admin roles
router.get('/profile', AdminController.requireAuth, requireAdminAccess(), ProfileController.profile);
router.post('/profile/edit', AdminController.requireAuth, requireAdminAccess(), ProfileController.editProfilePost);

// Users management - only Super Admin and Admin
router.get('/users', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.users);
router.get('/users/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.createUser);
router.post('/users/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.createUserPost);
router.get('/users/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.editUser);
router.post('/users/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.editUserPost);
router.delete('/users/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), UsersController.deleteUser);

// Newsletter (Content Management) - Super Admin, Admin, Content Manager
router.get('/newsletter', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), NewsletterController.list);
router.get('/newsletter/export-csv', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), NewsletterController.exportCsv);

router.get('/reviews', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ReviewsController.list);

// Live chat - Super Admin, Admin
router.get('/chat', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ChatController.index);
router.get('/api/chat/messages', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin']), ChatController.messagesJson);
router.get('/api/chat/conversations', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin']), ChatController.conversationsJson);
router.get('/api/chat/unread-total', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin']), ChatController.unreadTotalJson);

// Pages management - Super Admin, Admin, Content Manager
router.get('/pages', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.pages);
router.get('/pages/tags', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.tags);
router.get('/pages/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.createPage);
router.post('/pages/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.createPagePost);
router.get('/pages/:key/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.editPage);
router.post('/pages/:key/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.editPagePost);
router.delete('/pages/:key', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.deletePage);
router.delete('/pages/:key/delete-image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.deletePageImage);

// Pages API endpoints for validation
router.get('/api/pages/check-key/:key', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.checkPageKey);
router.get('/api/pages/check-url/:url', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.checkPageUrl);
router.post('/api/upload-image', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.uploadImage);

// Video embed API endpoint
router.post('/api/video/embed', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.fetchVideoEmbed);

// Image management API endpoints
router.get('/api/page-images', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.getPageImages);
router.get('/api/public-images', AdminController.requireApiAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.getPublicImages);

// Page Photo Gallery API endpoints
router.post('/pages/:key/photos/upload', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.uploadPagePhotos);
router.get('/pages/:key/photos', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.getPagePhotos);
router.delete('/pages/:key/photos/:photoId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.deletePageGalleryPhoto);
router.post('/pages/:key/photos/reorder', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), PagesController.reorderPagePhotos);
router.post('/pages/:key/upload-file', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ...PagesController.uploadPageFile);

// Slider management - Super Admin, Admin, Content Manager
router.get('/slider', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.slider);
router.get('/slider/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.createSlide);
router.post('/slider/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.handleSliderUpload, SliderController.createSlidePost);
router.get('/slider/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.editSlide);
router.post('/slider/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.handleSliderUpload, SliderController.editSlidePost);
router.delete('/slider/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.deleteSlide);
router.get('/slider/:id/move-up', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.moveSlideUp);
router.get('/slider/:id/move-down', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.moveSlideDown);
router.get('/slider/:id/toggle-active', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.toggleSlideActive);
router.post('/api/slider/upload-image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), SliderController.uploadImage);

router.get('/home-content', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.index);
router.post('/home-content/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.update);
router.post('/home-content/service-columns/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.updateServiceColumns);
router.post('/home-content/blocks/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.createBlock);
router.post('/home-content/blocks/reorder', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.reorderBlocks);
router.post('/home-content/blocks/:id/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.updateBlock);
router.post('/home-content/blocks/:id/delete', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), HomeContentController.deleteBlock);

// Projects management - Super Admin, Admin, Content Manager
router.get('/projects', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.projects);
router.get('/projects/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.createProject);
router.post('/projects/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.createProjectPost);
router.get('/projects/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.editProject);
router.post('/projects/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.editProjectPost);
router.delete('/projects/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.deleteProject);
router.delete('/projects/:id/delete-image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.deleteProjectImage);

// Project works management (AJAX endpoints)
router.post('/projects/:projectId/works', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.addWorkToProject);
router.put('/projects/:projectId/works/:workId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.updateWorkInProject);
router.delete('/projects/:projectId/works/:workId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.deleteWorkFromProject);
router.delete('/projects/:projectId/works/:workId/images/:imageName', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProjectsController.deleteWorkImage);

// Site settings management - Super Admin, Admin only
router.get('/site-settings', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), SiteSettingsController.siteSettings);
router.post('/site-settings/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), SiteSettingsController.updateSettings);
router.post('/site-settings/test-upload', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), SiteSettingsController.testUpload);
router.delete('/site-settings/delete-image/:type', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), SiteSettingsController.deleteSiteImage);

router.get('/contact-settings', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ContactSettingsController.index);
router.post('/contact-settings/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ContactSettingsController.update);

router.get('/integration-settings', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), IntegrationSettingsController.index);
router.post('/integration-settings/update', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), IntegrationSettingsController.update);
router.post('/integration-settings/test-email', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), IntegrationSettingsController.testEmail);

// Email Templates management - Super Admin, Admin
router.get('/email-templates', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EmailTemplatesController.index);
router.get('/email-templates/:key/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EmailTemplatesController.edit);
router.post('/email-templates/:key/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EmailTemplatesController.update);

// Menu management - Super Admin, Admin, Content Manager
router.get('/menus', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.menus);
router.get('/menus/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.createMenu);
router.post('/menus/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.createMenuPost);
router.get('/menus/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.editMenu);
router.post('/menus/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.editMenuPost);
router.delete('/menus/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.deleteMenu);

// Menu items management (AJAX endpoints)
router.post('/menus/:menuId/items', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.addMenuItem);
router.put('/menus/:menuId/items/:itemId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.updateMenuItem);
router.delete('/menus/:menuId/items/:itemId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.deleteMenuItem);
router.post('/menus/:menuId/items/:itemId/move', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.moveMenuItem);
router.get('/menus/:menuId/items', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.getMenuItems);
router.get('/api/pages', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), MenuController.getPages);
router.post('/upload-file', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ...MenuController.uploadFile);

// Theme management API routes - Super Admin, Admin only
router.get('/theme', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ThemeController.themeManagement);
// Theme API routes removed - theme panel functionality disabled

// Products management - Super Admin, Admin, Content Manager
router.get('/products', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.index);
router.get('/products/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.create);
router.post('/products/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImageUploadConfig().single('image') as unknown as RequestHandler), ProductsController.createPost);
router.get('/products/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.edit);
router.post('/products/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImagesUploadConfig().none() as unknown as RequestHandler), ProductsController.editPost);
router.delete('/products/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.delete);
router.post('/products/:id/images', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImagesUploadConfig().array('images', 20) as unknown as RequestHandler), ProductsController.uploadImage);
router.delete('/products/:id/images/:imageId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.deleteImage);
router.post('/products/:id/images/set-primary', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.setPrimaryImage);
router.get('/products/:id/images', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.getImages);
// router.post('/products/:id/variants/bulk', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.bulkCreateVariants);
router.post('/products/:id/variants', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImageUploadConfig().single('image') as unknown as RequestHandler), ProductsController.createVariant);
router.put('/products/:id/variants/:variantId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImageUploadConfig().single('image') as unknown as RequestHandler), ProductsController.updateVariant);
router.delete('/products/:id/variants/:variantId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.deleteVariant);
router.post('/products/:id/variants/:variantId/image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImageUploadConfig().single('image') as unknown as RequestHandler), ProductsController.uploadVariantImage);
router.delete('/products/:id/variants/:variantId/images/:imageId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.deleteVariantImage);

// Product attribute management routes
router.get('/products/:id/attributes', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.getProductAttributes);
router.post('/products/:id/attributes', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.addProductAttribute);
router.put('/products/:id/attributes/:attributeId/selection', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.updateAttributeSelection);
router.delete('/products/:id/attributes/:attributeId', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.removeProductAttribute);

// Attribute value image management routes
router.post('/attributes/values/:valueId/image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createProductImageUploadConfig().single('image') as unknown as RequestHandler), ProductsController.uploadAttributeValueImage);
router.delete('/attributes/values/:valueId/image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.deleteAttributeValueImage);

// Bulk variant creation from attribute combinations
router.post('/products/:id/variants/bulk', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.createBulkVariants);
router.post('/products/:id/variants/reset-stocks', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), ProductsController.resetAllVariantStocks);

// Categories management - Super Admin, Admin, Content Manager
router.get('/categories', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.index);
router.get('/categories/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.createCategory);
router.post('/categories/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (categoryMediaUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]) as unknown as RequestHandler), CategoriesController.createCategoryPost);
router.get('/categories/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.editCategory);
router.post('/categories/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (categoryMediaUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]) as unknown as RequestHandler), CategoriesController.editCategoryPost);
router.delete('/categories/:id/delete-image', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.deleteCategoryImage);
router.delete('/categories/:id/delete-video', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.deleteCategoryVideo);
router.delete('/categories/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), CategoriesController.delete);

// Brands management - Super Admin, Admin, Content Manager
router.get('/brands', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), BrandsController.index);
router.get('/brands/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), BrandsController.createBrand);
router.post('/brands/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createBrandUploadConfig().single('logo') as unknown as RequestHandler), BrandsController.createBrandPost);
router.get('/brands/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), BrandsController.editBrand);
router.post('/brands/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), (storageService.createBrandUploadConfig().single('logo') as unknown as RequestHandler), BrandsController.editBrandPost);
router.delete('/brands/:id/delete-logo', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), BrandsController.deleteBrandLogo);
router.post('/brands/:id/delete', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), BrandsController.deleteBrand);

// Product Attributes management - Super Admin, Admin
router.get('/product-attributes', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.index);
router.get('/product-attributes/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.create);
router.post('/product-attributes/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.createPost);
router.get('/product-attributes/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.edit);
router.post('/product-attributes/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.editPost);
router.delete('/product-attributes/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.delete);
router.get('/api/product-attribute-values/:id/check-usage', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.checkValueUsage);
router.get('/api/product-attributes', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ProductAttributesController.getProductAttributes);

// Orders management - Super Admin, Admin
router.get('/orders', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.index);
// Shipments (orders with shipment created) - Schedule Pickup
router.get('/shipments', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), ShipmentsController.index);
router.post('/shipments/schedule-pickup', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), ShipmentsController.schedulePickup);
router.get('/orders/:id/edit-cart', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.editCart);
router.get('/api/orders/products', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.getProductsForCart);
router.get('/orders/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.detail);
router.post('/orders/:id/status', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.updateStatus);
router.post('/orders/:id/notes', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.updateNotes);
router.post('/orders/:id/schedule-pickup', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.schedulePickup);
router.post('/orders/:id/schedule-pickup-and-waybill', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.schedulePickupAndWaybill);
router.post('/orders/:id/create-waybill', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.createWaybill);
router.post('/orders/:id/print-waybill', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.printWaybill);
router.post('/orders/:id/cart', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Accounting']), OrdersController.updateCart);

// Discounts management - Super Admin, Admin, Content Manager
router.get('/discounts', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.index);
router.get('/discounts/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.createDiscount);
router.post('/discounts/create', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.createDiscountPost);
router.get('/discounts/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.editDiscount);
router.post('/discounts/:id/edit', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.editDiscountPost);
router.delete('/discounts/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin', 'Content Manager']), DiscountsController.delete);

// Customers management - Super Admin, Admin
router.get('/customers', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), CustomersController.index);
router.get('/customers/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), CustomersController.detail);
router.post('/customers/:id/status', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), CustomersController.updateStatus);

// E-commerce Settings - Super Admin, Admin
router.get('/ecommerce-settings', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.index);
router.post('/ecommerce-settings', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.updateSettings);
router.post('/api/test-aramex-shipping', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.testAramexShipping);
router.post('/ecommerce-settings/shipping-zones', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.createShippingZone);
router.put('/ecommerce-settings/shipping-zones/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.updateShippingZone);
router.delete('/ecommerce-settings/shipping-zones/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.deleteShippingZone);
router.post('/ecommerce-settings/shipping-rates', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.createShippingRate);
router.put('/ecommerce-settings/shipping-rates/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.updateShippingRate);
router.delete('/ecommerce-settings/shipping-rates/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.deleteShippingRate);
router.put('/ecommerce-settings/payment-methods/:id', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), EcommerceSettingsController.updatePaymentMethod);

// Reports & Analytics - Super Admin, Admin
router.get('/reports', AdminController.requireAuth, requireRole(['Super Admin', 'Admin']), ReportsController.index);

// Language change route (no auth required - can change language on login page)
router.post('/change-language', (req: any, res: any) => {
  const { language } = req.body;
  const i18nService = require('../services/i18nService').i18nService;

  if (language && i18nService.isSupportedLanguage(language)) {
    // Save to session
    if (req.session) {
      req.session.language = language;
    }

    // Update user profile if logged in
    if (req.session && req.session.user) {
      const usersService = require('../services/usersService').usersService;
      usersService.updateUserLanguage(req.session.user.id, language).catch((err: any) => {
        console.error('Error updating user language:', err);
      });
    }

    res.json({ success: true, language });
  } else {
    res.status(400).json({ success: false, error: 'Invalid language' });
  }
});

// Logout
router.get('/logout', AdminController.logout);

export default router; 