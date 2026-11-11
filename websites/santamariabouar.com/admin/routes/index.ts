import { Router } from 'express';
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
import { MenuController } from '../controllers/menuController';
import { ApartmentsController } from '../controllers/apartmentsController';
import { PaymentsController } from '../controllers/paymentsController';
import { CommonExpensesController } from '../controllers/commonExpensesController';
import { AccountsController } from '../controllers/accountsController';
import { TransactionsController } from '../controllers/transactionsController';
import { TransactionCategoriesController } from '../controllers/transactionCategoriesController';
import { InvoicesController } from '../controllers/invoicesController';
import { ReportsController } from '../controllers/reportsController';
import { ApartmentWalletController } from '../controllers/apartmentWalletController';
import { MemberPortalAdminController } from '../controllers/memberPortalAdminController';
import { CompoundAmenitiesController } from '../controllers/compoundAmenitiesController';
import { MainGateAccessController } from '../controllers/mainGateAccessController';
import { GateOpenLogController } from '../controllers/gateOpenLogController';
import { SafemateUsersController } from '../controllers/safemateUsersController';
import { SafemateDirectController } from '../controllers/safemateDirectController';
import { ParkingMapController } from '../controllers/parkingMapController';
import { StorageService } from '../services/storageService';
import { requireAdminAccess, requireRole, SUPER_ADMIN_ROLES, ADMIN_VIEW_ROLES } from '../utils/roleMiddleware';
import { loginRateLimiter } from '../../src/middleware/rateLimits';
import { validateCsrf } from '../../src/middleware/csrf';
import { requireRecaptcha } from '../../src/services/recaptchaService';

// Initialize storage service for multer configurations
const storageService = StorageService.getInstance();
const sliderUpload = storageService.createSliderUploadConfig();
const apartmentUpload = storageService.createApartmentUploadConfig();

// Authentication routes (no auth required)
router.get('/login', AdminController.login);
router.post('/login', loginRateLimiter, validateCsrf, requireRecaptcha, AdminController.loginPost);
// Always register in non-production; handler enforces ALLOW_DEV_LOGIN + credentials
if (process.env.NODE_ENV !== 'production') {
  router.post('/login/dev', loginRateLimiter, validateCsrf, AdminController.devLoginPost);
}

// Dashboard - Super Admin and Admin
router.get('/dashboard', AdminController.requireAuth, requireAdminAccess(), DashboardController.dashboard);
router.get('/dashboard/data', AdminController.requireAuth, requireAdminAccess(), DashboardController.dashboardData);

// Profile management - Super Admin and Admin
router.get('/profile', AdminController.requireAuth, requireAdminAccess(), ProfileController.profile);
router.post('/profile/edit', AdminController.requireAuth, requireAdminAccess(), ProfileController.editProfilePost);

// Users management - Admin read-only, Super Admin full
router.get('/users', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), UsersController.users);
router.get('/users/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), UsersController.createUser);
router.post('/users/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), UsersController.createUserPost);
router.get('/users/:id/edit', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), UsersController.editUser);
router.post('/users/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), UsersController.editUserPost);
router.delete('/users/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), UsersController.deleteUser);
router.post(
  '/users/:id/impersonate',
  AdminController.requireAuth,
  requireRole(SUPER_ADMIN_ROLES),
  validateCsrf,
  UsersController.impersonateUser
);

// Pages management - Super Admin only
router.get('/pages', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.pages);
router.get('/pages/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.createPage);
router.post('/pages/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.createPagePost);
router.get('/pages/:key/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.editPage);
router.post('/pages/:key/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.editPagePost);
router.delete('/pages/:key', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.deletePage);
router.delete('/pages/:key/delete-image', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.deletePageImage);

// Pages API endpoints for validation
router.get('/api/pages/check-key/:key', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.checkPageKey);
router.get('/api/pages/check-url/:url', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.checkPageUrl);
router.post('/api/upload-image', AdminController.requireApiAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.uploadImage);

// Image management API endpoints
router.get('/api/page-images', AdminController.requireApiAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.getPageImages);
router.get('/api/public-images', AdminController.requireApiAuth, requireRole(SUPER_ADMIN_ROLES), PagesController.getPublicImages);

// Slider management - Super Admin, Admin, Content Manager
router.get('/slider', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.slider);
router.get('/slider/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.createSlide);
router.post('/slider/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.handleSliderUpload, SliderController.createSlidePost);
router.get('/slider/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.editSlide);
router.post('/slider/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.handleSliderUpload, SliderController.editSlidePost);
router.delete('/slider/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.deleteSlide);
router.get('/slider/:id/move-up', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.moveSlideUp);
router.get('/slider/:id/move-down', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.moveSlideDown);
router.get('/slider/:id/toggle-active', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.toggleSlideActive);
router.post('/api/slider/upload-image', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SliderController.uploadImage);

// Parking map - Super Admin draws bays on the site plan
router.get('/parking-map', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ParkingMapController.index);
router.post('/parking-map', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), validateCsrf, ParkingMapController.save);

// Apartments management - Super Admin, Admin
router.get('/apartments', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.apartments);
router.get('/apartments/export', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.exportExcel);
router.get('/apartments/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.createApartment);
router.post('/apartments/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.createApartmentPost);
router.get('/apartments/:id/edit', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.editApartment);
router.post('/apartments/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.editApartmentPost);
router.post('/apartments/:id/gate-access', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.addGateAccessPost);
router.post('/apartments/:id/gate-access/:userId/revoke', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.revokeGateAccessPost);
router.post('/apartments/:id/members', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.addApartmentMemberPost);
router.post('/apartments/:id/members/:userId/primary', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.setPrimaryOwnerPost);
router.post('/apartments/:id/members/:userId/:role/remove', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.removeApartmentMemberPost);
router.get('/apartments/:id/statement', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.apartmentStatement);
router.delete('/apartments/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.deleteApartment);
router.get('/api/apartments/stats', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.getApartmentStats);

// Apartment image management
router.post('/apartments/:id/upload-official-image', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), apartmentUpload.single('officialImage'), ApartmentsController.uploadOfficialImage);
router.post('/apartments/:id/upload-image', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), apartmentUpload.single('image'), ApartmentsController.uploadImage);
router.delete('/apartments/:id/images/:imageName', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.deleteImage);
router.post('/apartments/:id/set-official/:imageName', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.setOfficialImage);

// Apartment payments API
router.get('/apartments/:id/unsettled-years', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ApartmentsController.getUnsettledYears);
router.post('/apartments/bulk-create-invoices', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentsController.bulkCreateInvoices);

// Invoices management - Super Admin, Admin, Accounting
router.get('/invoices', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.invoices);
router.get('/invoices/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.createInvoice);
router.post('/invoices/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.createInvoicePost);
router.get('/invoices/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.editInvoice);
router.post('/invoices/:id/update', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.updateInvoice);
router.post('/invoices/:id/delete', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.deleteInvoice);
router.get('/invoices/:id/pay', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.payInvoice);
router.post('/invoices/:id/pay', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.payInvoicePost);
router.get('/invoices/:id/payment-receipt', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.paymentReceipt);
router.get('/api/invoices/:id/payment-breakdown', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), InvoicesController.paymentBreakdown);

// Projects management - Super Admin, Admin, Content Manager
router.get('/projects', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.projects);
router.get('/projects/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.createProject);
router.post('/projects/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.createProjectPost);
router.get('/projects/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.editProject);
router.post('/projects/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.editProjectPost);
router.delete('/projects/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.deleteProject);
router.delete('/projects/:id/delete-image', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.deleteProjectImage);

// Project works management (AJAX endpoints)
router.post('/projects/:projectId/works', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.addWorkToProject);
router.put('/projects/:projectId/works/:workId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.updateWorkInProject);
router.delete('/projects/:projectId/works/:workId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.deleteWorkFromProject);
router.delete('/projects/:projectId/works/:workId/images/:imageName', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ProjectsController.deleteWorkImage);

// Site settings management - Super Admin, Admin only
router.get('/site-settings', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SiteSettingsController.siteSettings);
router.post('/site-settings/update', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SiteSettingsController.updateSettings);
router.post('/site-settings/test-upload', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SiteSettingsController.testUpload);
router.delete('/site-settings/delete-image/:type', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SiteSettingsController.deleteSiteImage);

// Payments management - Super Admin, Admin, Accounting
router.get('/payments', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.payments);
router.post('/payments/set-price', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.setPriceForYear);
router.delete('/payments/price/:year', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.deletePriceForYear);
router.post('/payments/generate-payments', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.generatePaymentsForYear);
router.post('/payments/simulate', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.simulatePayments);
router.post('/payments/set-interest-rate', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.setYearlyInterestRate);
router.post('/payments/simulate-interest', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.simulateInterest);
router.post('/payments/generate-interest', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.generateInterest);
router.get('/api/payments/data', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), PaymentsController.getPriceData);

// Common Expenses - Super Admin, Admin, Accounting
router.get('/common-expenses', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CommonExpensesController.commonExpenses);
router.get('/common-expenses/export', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CommonExpensesController.exportCommonExpenses);
router.get('/common-expenses/unpaid-report', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), CommonExpensesController.unpaidReport);

// Accounts management - Super Admin, Admin, Accounting
router.get('/accounts', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.accounts);
router.get('/accounts/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.createAccount);
router.post('/accounts/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.createAccountPost);
router.get('/accounts/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.editAccount);
router.post('/accounts/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.editAccountPost);
router.delete('/accounts/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.deleteAccount);
router.get('/api/accounts/stats', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), AccountsController.getAccountStats);

// Transactions management - Super Admin, Admin, Accounting
router.get('/transactions', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.transactions);
router.get('/transactions/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.createTransaction);
router.post('/transactions/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.handleReceiptUpload, TransactionsController.createTransactionPost);
router.get('/transactions/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.editTransaction);
router.post('/transactions/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.handleReceiptUpload, TransactionsController.editTransactionPost);
router.delete('/transactions/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.deleteTransaction);
router.get('/transactions/:id/receipt', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.generateReceipt);
router.post('/transactions/generate-receipt', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.generateReceiptPost);
router.get('/transactions/combined-receipt', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.viewCombinedReceipt);
router.post('/transactions/generate-combined-receipt', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.generateCombinedReceiptPost);
router.get('/api/transactions/account/:accountId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.getTransactionsByAccount);
router.get('/api/transactions/summary', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionsController.getTransactionSummary);
router.get('/transactions/report/by-category', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), TransactionsController.reportByCategory);
router.get('/transactions/report/chronological', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), TransactionsController.reportChronological);

// Apartment Wallets - Super Admin, Admin, Accounting
router.get('/wallets', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.list);
router.get('/wallets/:apartmentId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.detail);
router.get('/wallets/:apartmentId/report', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.report);
router.post('/wallets/:apartmentId/add', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.addEntryPost);
router.post('/wallets/:apartmentId/subtract', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.subtractEntryPost);
router.post('/wallets/entries/:entryId/update', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.updateEntryPost);
router.post('/wallets/entries/:entryId/delete', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ApartmentWalletController.deleteEntryPost);

// Reports - Super Admin, Admin, Accounting
router.get('/reports/transactions-by-category', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ReportsController.transactionsByCategory);
router.get('/reports/transactions-chronological', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ReportsController.transactionsChronological);
router.get('/reports/unpaid-report', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ReportsController.unpaidCommonExpenses);
router.get('/reports/credits-report', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ReportsController.creditsReport);
router.get('/reports/main-gate-access', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), (_req, res) => {
  res.redirect(301, '/admin/main-gate-access');
});

// Main Gate Access - Super Admin (edit), Admin (view)
router.get('/main-gate-access', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), MainGateAccessController.index);
router.get('/gate-open-log', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), GateOpenLogController.index);
router.post('/main-gate-access', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MainGateAccessController.addPost);
router.post('/main-gate-access/:apartmentId/:userId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MainGateAccessController.editPost);
router.post('/main-gate-access/:apartmentId/:userId/revoke', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MainGateAccessController.revokePost);
router.get('/main-gate/safemate', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateUsersController.index);
router.get('/main-gate/safemate/export', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateUsersController.exportNumbers);
router.post('/main-gate/safemate/add', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateUsersController.addPost);
router.post('/main-gate/safemate/revoke', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateUsersController.revokePost);
router.get('/safemate-direct', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateDirectController.index);
router.post('/safemate-direct/add', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateDirectController.addPost);
router.post('/safemate-direct/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateDirectController.editPost);
router.post('/safemate-direct/delete', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), SafemateDirectController.deletePost);
router.get('/reports/api/credits-report/apartments/:apartmentId/invoices', AdminController.requireAuth, requireRole(ADMIN_VIEW_ROLES), ReportsController.creditsReportApartmentInvoices);
router.post('/reports/api/credits-report/allocate-credit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ReportsController.creditsReportAllocateCredit);
router.post('/reports/api/credits-report/allocate-credit-owner', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ReportsController.creditsReportAllocateCreditOwner);
router.post('/reports/api/credits-report/assign-owner-apartment', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ReportsController.creditsReportAssignOwnerApartment);

// Transaction Categories management - Super Admin, Admin, Accounting
router.get('/transaction-categories', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.categories);
router.get('/transaction-categories/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.createCategory);
router.post('/transaction-categories/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.createCategoryPost);
router.get('/transaction-categories/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.editCategory);
router.post('/transaction-categories/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.editCategoryPost);
router.delete('/transaction-categories/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.deleteCategory);
router.get('/api/transaction-categories/active', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), TransactionCategoriesController.getActiveCategories);

// Menu management - Super Admin, Admin, Content Manager
router.get('/menus', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.menus);
router.get('/menus/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.createMenu);
router.post('/menus/create', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.createMenuPost);
router.get('/menus/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.editMenu);
router.post('/menus/:id/edit', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.editMenuPost);
router.delete('/menus/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.deleteMenu);

// Menu items management (AJAX endpoints)
router.post('/menus/:menuId/items', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.addMenuItem);
router.put('/menus/:menuId/items/:itemId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.updateMenuItem);
router.delete('/menus/:menuId/items/:itemId', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.deleteMenuItem);
router.post('/menus/:menuId/items/:itemId/move', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.moveMenuItem);
router.get('/menus/:menuId/items', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.getMenuItems);
router.get('/api/pages', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.getPages);
router.post('/admin/upload-file', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MenuController.uploadFile);

// Theme management API routes - Super Admin, Admin only
router.get('/theme', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), ThemeController.themeManagement);
// Theme API routes removed - theme panel functionality disabled

// Member portal approval queues - Super Admin, Admin
router.get('/access-requests', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.accessRequests);
router.get('/access-requests/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.accessRequestDetail);
router.post('/access-requests/:id/approve', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.approveAccessRequest);
router.post('/access-requests/:id/reject', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.rejectAccessRequest);

router.get('/listing-requests', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.listingRequests);
router.post('/listing-requests/:id/approve', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.approveListingRequest);
router.post('/listing-requests/:id/reject', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.rejectListingRequest);

router.get('/gate-access-requests', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.gateAccessRequests);
router.post('/gate-access-requests/:id/approve', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.approveGateAccessRequest);
router.post('/gate-access-requests/:id/reject', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.rejectGateAccessRequest);

router.get('/photo-approvals', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.photoApprovals);
router.post('/photo-approvals/:id/approve', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.approvePhoto);
router.post('/photo-approvals/:id/reject', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), MemberPortalAdminController.rejectPhoto);

router.get('/compound-amenities', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CompoundAmenitiesController.index);
router.post('/compound-amenities', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CompoundAmenitiesController.create);
router.post('/compound-amenities/:id', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CompoundAmenitiesController.update);
router.post('/compound-amenities/:id/delete', AdminController.requireAuth, requireRole(SUPER_ADMIN_ROLES), CompoundAmenitiesController.delete);

// Logout
router.get('/logout', AdminController.logout);

export default router; 