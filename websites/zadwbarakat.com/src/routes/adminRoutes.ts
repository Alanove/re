import { Router, type Request, type RequestHandler, type Response } from 'express';
import { devLoginCredentials } from '../config/env.js';
import { AuthController } from '../controllers/admin/authController.js';
import {
  AlbumsAdminController,
  ArticlesAdminController,
  BooksAdminController,
  HymnsAdminController,
  PurchasesAdminController,
  SectionsAdminController,
  VideosAdminController
} from '../controllers/admin/contentAdminControllers.js';
import { BooksBulkController } from '../controllers/admin/booksBulkController.js';
import { DashboardController } from '../controllers/admin/dashboardController.js';
import { HomeAdminController } from '../controllers/admin/homeAdminController.js';
import { InquiriesAdminController } from '../controllers/admin/inquiriesAdminController.js';
import { MediaApiController } from '../controllers/admin/mediaApiController.js';
import { MenusAdminController } from '../controllers/admin/menusAdminController.js';
import { NewsletterAdminController } from '../controllers/admin/newsletterAdminController.js';
import { PagesAdminController } from '../controllers/admin/pagesAdminController.js';
import { SettingsAdminController } from '../controllers/admin/settingsAdminController.js';
import { UsersAdminController } from '../controllers/admin/usersAdminController.js';
import { adminLocals } from '../middleware/adminLocals.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ensureCsrfToken, verifyCsrf, verifySameOrigin } from '../middleware/csrf.js';
import { adminWriteRateLimit, loginRateLimit } from '../middleware/security.js';
import { uploadAudio, uploadBranding, uploadCsv, uploadDocument, uploadFields, uploadMediaFields } from '../middleware/upload.js';

const pageUploads = uploadMediaFields([
  { name: 'heroImageFile', maxCount: 1 },
  { name: 'heroVideoFile', maxCount: 1 },
  { name: 'galleryFiles', maxCount: 25 }
]);
const singleImage = uploadFields([{ name: 'imageFile', maxCount: 1 }]);
const albumImages = uploadFields([{ name: 'imageFiles', maxCount: 30 }]);
const noFiles = uploadFields([]);
const editorImage = uploadFields([{ name: 'image', maxCount: 1 }]);

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

interface CrudHandlers {
  list: AsyncHandler;
  createForm: AsyncHandler;
  create: AsyncHandler;
  editForm: AsyncHandler;
  update: AsyncHandler;
  remove: AsyncHandler;
}

function mountCrud(router: Router, base: string, controller: CrudHandlers, upload: RequestHandler): void {
  router.get(base, asyncHandler(controller.list));
  router.get(`${base}/create`, asyncHandler(controller.createForm));
  router.post(`${base}/create`, upload, asyncHandler(controller.create));
  router.get(`${base}/:id/edit`, asyncHandler(controller.editForm));
  router.post(`${base}/:id/edit`, upload, asyncHandler(controller.update));
  router.delete(`${base}/:id`, asyncHandler(controller.remove));
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

  mountCrud(router, '/sections', SectionsAdminController, singleImage);
  mountCrud(router, '/articles', ArticlesAdminController, singleImage);
  router.get('/books/export.csv', asyncHandler(BooksBulkController.exportCsv));
  router.post('/books/import', uploadCsv('csvFile'), asyncHandler(BooksBulkController.importCsv));
  mountCrud(router, '/books', BooksAdminController, noFiles);
  mountCrud(router, '/hymns', HymnsAdminController, uploadAudio('audioFile'));
  mountCrud(router, '/albums', AlbumsAdminController, albumImages);
  mountCrud(router, '/videos', VideosAdminController, singleImage);
  mountCrud(router, '/purchases', PurchasesAdminController, singleImage);

  router.get('/home', asyncHandler(HomeAdminController.list));
  router.get('/home/:key/edit', asyncHandler(HomeAdminController.editForm));
  router.post('/home/:key/edit', asyncHandler(HomeAdminController.update));

  router.get('/menus', asyncHandler(MenusAdminController.list));
  router.post('/menus', asyncHandler(MenusAdminController.create));
  router.get('/menus/:id/edit', asyncHandler(MenusAdminController.editForm));
  router.post('/menus/:id/edit', asyncHandler(MenusAdminController.update));
  router.delete('/menus/:id', asyncHandler(MenusAdminController.remove));

  router.get('/inquiries', asyncHandler(InquiriesAdminController.list));
  router.get('/inquiries/:id', asyncHandler(InquiriesAdminController.show));
  router.delete('/inquiries/:id', asyncHandler(InquiriesAdminController.remove));

  router.get('/newsletter', asyncHandler(NewsletterAdminController.list));
  router.get('/newsletter/export.csv', asyncHandler(NewsletterAdminController.exportCsv));
  router.delete('/newsletter/:id', asyncHandler(NewsletterAdminController.remove));

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
