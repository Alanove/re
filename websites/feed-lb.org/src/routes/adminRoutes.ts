import { Router } from 'express';
import { devLoginCredentials } from '../config/env.js';
import { AuthController } from '../controllers/admin/authController.js';
import { DashboardController } from '../controllers/admin/dashboardController.js';
import { HomeAdminController, homeUploadFields } from '../controllers/admin/homeAdminController.js';
import { InquiriesAdminController } from '../controllers/admin/inquiriesAdminController.js';
import { MediaApiController } from '../controllers/admin/mediaApiController.js';
import { MenusAdminController } from '../controllers/admin/menusAdminController.js';
import { NewsAdminController } from '../controllers/admin/newsAdminController.js';
import { OfficesAdminController } from '../controllers/admin/officesAdminController.js';
import { PagesAdminController } from '../controllers/admin/pagesAdminController.js';
import { PartnersAdminController } from '../controllers/admin/partnersAdminController.js';
import { SettingsAdminController } from '../controllers/admin/settingsAdminController.js';
import { UsersAdminController } from '../controllers/admin/usersAdminController.js';
import { adminLocals } from '../middleware/adminLocals.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ensureCsrfToken, verifyCsrf, verifySameOrigin } from '../middleware/csrf.js';
import { adminWriteRateLimit, loginRateLimit } from '../middleware/security.js';
import { uploadBranding, uploadDocument, uploadFields, uploadMediaFields } from '../middleware/upload.js';

const pageUploads = uploadMediaFields([
  { name: 'heroImageFile', maxCount: 1 },
  { name: 'heroVideoFile', maxCount: 1 },
  { name: 'galleryFiles', maxCount: 25 }
]);
const homeSectionFiles = uploadMediaFields(homeUploadFields());
const partnerLogo = uploadFields([{ name: 'logoFile', maxCount: 1 }]);
const editorImage = uploadFields([{ name: 'image', maxCount: 1 }]);

export function createAdminRouter(): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  router.use(ensureCsrfToken, verifySameOrigin, verifyCsrf, adminLocals);

  router.get('/', (req, res) => {
    res.redirect(req.currentUser ? '/admin/dashboard' : '/admin/login');
  });
  router.get('/login', AuthController.showLogin);
  router.post('/login', loginRateLimit, asyncHandler(AuthController.login));
  if (devLoginCredentials) {
    router.post('/dev-login', loginRateLimit, asyncHandler(AuthController.devLogin));
  }
  router.post('/logout', asyncHandler(AuthController.logout));

  router.use(requireAuth, adminWriteRateLimit);

  router.get('/dashboard', asyncHandler(DashboardController.show));
  router.get('/dashboard/data', asyncHandler(DashboardController.data));

  router.get('/pages', asyncHandler(PagesAdminController.list));
  router.get('/pages/create', asyncHandler(PagesAdminController.createForm));
  router.post('/pages/create', pageUploads, asyncHandler(PagesAdminController.create));
  router.get('/pages/:id/edit', asyncHandler(PagesAdminController.editForm));
  router.post('/pages/:id/edit', pageUploads, asyncHandler(PagesAdminController.update));
  router.delete('/pages/:id/hero-image', asyncHandler(PagesAdminController.removeHeroImage));
  router.delete('/pages/:id', asyncHandler(PagesAdminController.remove));
  router.post('/pages/:key/upload-file', uploadDocument('file'), asyncHandler(MediaApiController.uploadFile));

  router.get('/news', asyncHandler(NewsAdminController.list));
  router.get('/news/create', asyncHandler(NewsAdminController.createForm));
  router.post('/news/create', pageUploads, asyncHandler(NewsAdminController.create));
  router.get('/news/:id/edit', asyncHandler(NewsAdminController.editForm));
  router.post('/news/:id/edit', pageUploads, asyncHandler(NewsAdminController.update));
  router.delete('/news/:id', asyncHandler(NewsAdminController.remove));

  router.get('/partners', asyncHandler(PartnersAdminController.list));
  router.get('/partners/create', PartnersAdminController.createForm);
  router.post('/partners/create', partnerLogo, asyncHandler(PartnersAdminController.create));
  router.get('/partners/:id/edit', asyncHandler(PartnersAdminController.editForm));
  router.post('/partners/:id/edit', partnerLogo, asyncHandler(PartnersAdminController.update));
  router.delete('/partners/:id', asyncHandler(PartnersAdminController.remove));

  router.get('/home', asyncHandler(HomeAdminController.list));
  router.get('/home/:key/edit', asyncHandler(HomeAdminController.editForm));
  router.post('/home/:key/edit', homeSectionFiles, asyncHandler(HomeAdminController.update));

  router.get('/menus', asyncHandler(MenusAdminController.list));
  router.post('/menus', asyncHandler(MenusAdminController.create));
  router.get('/menus/:id/edit', asyncHandler(MenusAdminController.editForm));
  router.post('/menus/:id/edit', asyncHandler(MenusAdminController.update));
  router.delete('/menus/:id', asyncHandler(MenusAdminController.remove));

  router.get('/offices', asyncHandler(OfficesAdminController.list));
  router.get('/offices/create', OfficesAdminController.createForm);
  router.post('/offices/create', asyncHandler(OfficesAdminController.create));
  router.get('/offices/:id/edit', asyncHandler(OfficesAdminController.editForm));
  router.post('/offices/:id/edit', asyncHandler(OfficesAdminController.update));
  router.delete('/offices/:id', asyncHandler(OfficesAdminController.remove));

  router.get('/inquiries', asyncHandler(InquiriesAdminController.list));
  router.get('/inquiries/:id', asyncHandler(InquiriesAdminController.show));
  router.delete('/inquiries/:id', asyncHandler(InquiriesAdminController.remove));

  router.get('/profile', asyncHandler(UsersAdminController.profileForm));
  router.post('/profile', asyncHandler(UsersAdminController.updateProfile));

  router.get('/users', requireAdmin, asyncHandler(UsersAdminController.list));
  router.get('/users/create', requireAdmin, UsersAdminController.createForm);
  router.post('/users/create', requireAdmin, asyncHandler(UsersAdminController.create));
  router.get('/users/:id/edit', requireAdmin, asyncHandler(UsersAdminController.editForm));
  router.post('/users/:id/edit', requireAdmin, asyncHandler(UsersAdminController.update));
  router.delete('/users/:id', requireAdmin, asyncHandler(UsersAdminController.remove));

  router.get('/site-settings', requireAdmin, asyncHandler(SettingsAdminController.editForm));
  router.post('/site-settings', requireAdmin, uploadBranding, asyncHandler(SettingsAdminController.update));

  router.get('/api/pages/check-slug', asyncHandler(PagesAdminController.checkSlug));
  router.post('/api/upload-image', editorImage, asyncHandler(MediaApiController.uploadImage));
  router.get('/api/page-images', asyncHandler(MediaApiController.pageImages));
  router.get('/api/public-images', asyncHandler(MediaApiController.publicImages));
  router.post('/api/video/embed', MediaApiController.videoEmbed);

  return router;
}
