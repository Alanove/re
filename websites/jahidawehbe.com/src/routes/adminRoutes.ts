import { Router } from 'express';
import { devLoginCredentials } from '../config/env.js';
import { AuthController } from '../controllers/admin/authController.js';
import { eventsAdminController, newsAdminController, type CollectionsAdminController } from '../controllers/admin/collectionsAdminController.js';
import { DashboardController } from '../controllers/admin/dashboardController.js';
import { HomeAdminController, homeUploadFields } from '../controllers/admin/homeAdminController.js';
import { MediaApiController } from '../controllers/admin/mediaApiController.js';
import { MenusAdminController } from '../controllers/admin/menusAdminController.js';
import { PagesAdminController } from '../controllers/admin/pagesAdminController.js';
import { SettingsAdminController } from '../controllers/admin/settingsAdminController.js';
import { SocialAdminController } from '../controllers/admin/socialAdminController.js';
import { UsersAdminController } from '../controllers/admin/usersAdminController.js';
import { VideosAdminController } from '../controllers/admin/videosAdminController.js';
import { adminLocals } from '../middleware/adminLocals.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ensureCsrfToken, verifyCsrf, verifySameOrigin } from '../middleware/csrf.js';
import { adminWriteRateLimit, loginRateLimit, youtubeActionRateLimit } from '../middleware/security.js';
import { uploadBranding, uploadDocument, uploadFields, uploadMediaFields } from '../middleware/upload.js';

const pageUploads = uploadMediaFields([
  { name: 'heroImageFile', maxCount: 1 },
  { name: 'heroVideoFile', maxCount: 1 },
  { name: 'galleryFiles', maxCount: 25 }
]);
const homeSectionFiles = uploadMediaFields(homeUploadFields());
const editorImage = uploadFields([{ name: 'image', maxCount: 1 }]);

function mountCollection(router: Router, path: string, controller: CollectionsAdminController): void {
  router.get(path, asyncHandler(controller.list));
  router.get(`${path}/create`, asyncHandler(controller.createForm));
  router.post(`${path}/create`, pageUploads, asyncHandler(controller.create));
  router.get(`${path}/:id/edit`, asyncHandler(controller.editForm));
  router.post(`${path}/:id/edit`, pageUploads, asyncHandler(controller.update));
}

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

  mountCollection(router, '/news', newsAdminController);
  mountCollection(router, '/events', eventsAdminController);

  router.get('/videos', asyncHandler(VideosAdminController.index));
  router.post('/videos/channel', youtubeActionRateLimit, asyncHandler(VideosAdminController.updateChannel));
  router.post('/videos/sync', youtubeActionRateLimit, asyncHandler(VideosAdminController.sync));
  router.post('/videos/add', youtubeActionRateLimit, asyncHandler(VideosAdminController.add));
  router.post('/videos/library', asyncHandler(VideosAdminController.updateLibrary));

  router.get('/social', asyncHandler(SocialAdminController.editForm));
  router.post('/social', asyncHandler(SocialAdminController.update));

  router.get('/home', asyncHandler(HomeAdminController.list));
  router.get('/home/:key/edit', asyncHandler(HomeAdminController.editForm));
  router.post('/home/:key/edit', homeSectionFiles, asyncHandler(HomeAdminController.update));

  router.get('/menus', asyncHandler(MenusAdminController.list));
  router.post('/menus', asyncHandler(MenusAdminController.create));
  router.get('/menus/:id/edit', asyncHandler(MenusAdminController.editForm));
  router.post('/menus/:id/edit', asyncHandler(MenusAdminController.update));
  router.delete('/menus/:id', asyncHandler(MenusAdminController.remove));

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
