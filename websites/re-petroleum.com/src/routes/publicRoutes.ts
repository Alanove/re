import { Router } from 'express';
import { PublicController } from '../controllers/publicController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { verifySameOrigin } from '../middleware/csrf.js';
import { contactRateLimit } from '../middleware/security.js';
import { siteLocals } from '../middleware/siteLocals.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/robots.txt', PublicController.robots);
  router.get('/sitemap.xml', asyncHandler(PublicController.sitemap));

  router.use(siteLocals);

  router.get('/', asyncHandler(PublicController.home));
  router.post('/contact', verifySameOrigin, contactRateLimit, asyncHandler(PublicController.submitContact));
  router.get('/{*path}', asyncHandler(PublicController.page));

  return router;
}
