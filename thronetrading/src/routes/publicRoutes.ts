import { Router } from 'express';
import { CatalogController } from '../controllers/catalogController.js';
import { PublicController } from '../controllers/publicController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { verifySameOrigin } from '../middleware/csrf.js';
import { legacyRedirects } from '../middleware/redirects.js';
import { contactRateLimit } from '../middleware/security.js';
import { siteLocals } from '../middleware/siteLocals.js';
import { BRANDS_BASE, PRODUCTS_BASE } from '../services/catalogService.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/robots.txt', PublicController.robots);
  router.get('/sitemap.xml', asyncHandler(PublicController.sitemap));

  router.use(legacyRedirects);
  router.use(siteLocals);

  router.get('/', asyncHandler(PublicController.home));
  router.post('/contact', verifySameOrigin, contactRateLimit, asyncHandler(PublicController.submitContact));

  router.get(PRODUCTS_BASE, asyncHandler(CatalogController.index));
  router.post(`${PRODUCTS_BASE}/enquiry`, verifySameOrigin, contactRateLimit, asyncHandler(CatalogController.enquire));
  router.get(`${PRODUCTS_BASE}/brands/:brand`, CatalogController.legacyBrand);
  router.get(`${PRODUCTS_BASE}/:category`, asyncHandler(CatalogController.category));
  router.get(`${PRODUCTS_BASE}/:category/:product`, asyncHandler(CatalogController.product));
  router.get(BRANDS_BASE, asyncHandler(CatalogController.brands));
  router.get(`${BRANDS_BASE}/:brand`, asyncHandler(CatalogController.brand));

  router.get('/{*path}', asyncHandler(PublicController.page));

  return router;
}
