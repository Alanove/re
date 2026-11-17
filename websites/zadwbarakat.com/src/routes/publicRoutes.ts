import { Router } from 'express';
import { CaptchaController } from '../controllers/captchaController.js';
import { PublicController } from '../controllers/publicController.js';
import { SearchController } from '../controllers/searchController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { verifySameOrigin } from '../middleware/csrf.js';
import { legacyRedirects } from '../middleware/redirects.js';
import { captchaChallengeRateLimit, contactRateLimit, newsletterRateLimit, suggestRateLimit } from '../middleware/security.js';
import { siteLocals } from '../middleware/siteLocals.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/robots.txt', PublicController.robots);
  router.get('/sitemap.xml', asyncHandler(PublicController.sitemap));
  router.get('/captcha/challenge', captchaChallengeRateLimit, CaptchaController.challenge);
  router.get('/api/search/suggest', suggestRateLimit, asyncHandler(SearchController.suggest));

  router.use(legacyRedirects);
  router.use(siteLocals);

  router.get('/', asyncHandler(PublicController.home));
  router.get('/search', asyncHandler(SearchController.page));
  router.post('/contact', verifySameOrigin, contactRateLimit, asyncHandler(PublicController.submitContact));
  router.post('/newsletter', verifySameOrigin, newsletterRateLimit, asyncHandler(PublicController.subscribe));

  router.get('/{*path}', asyncHandler(PublicController.resolve));

  return router;
}
