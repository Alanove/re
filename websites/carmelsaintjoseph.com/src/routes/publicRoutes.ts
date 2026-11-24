import { Router } from 'express';
import { CaptchaController } from '../controllers/captchaController.js';
import { PublicController } from '../controllers/publicController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ensureCsrfToken, verifyCsrf, verifySameOrigin } from '../middleware/csrf.js';
import { legacyRedirects } from '../middleware/redirects.js';
import { captchaChallengeRateLimit, contactRateLimit } from '../middleware/security.js';
import { siteLocals } from '../middleware/siteLocals.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/robots.txt', PublicController.robots);
  router.get('/sitemap.xml', asyncHandler(PublicController.sitemap));
  router.get('/captcha/challenge', captchaChallengeRateLimit, CaptchaController.challenge);

  router.use(legacyRedirects);
  router.use(ensureCsrfToken);
  router.use(siteLocals);

  router.get('/', asyncHandler(PublicController.home));
  router.get('/actualites/:year/:month', asyncHandler(PublicController.newsArchive));
  router.get('/actualites/:year', asyncHandler(PublicController.newsArchive));
  router.get('/nos-albums/:albumKey', asyncHandler(async (req, res) => {
    req.params.section = 'nos-albums';
    await PublicController.album(req, res);
  }));
  router.get('/visite-virtuelle/:albumKey', asyncHandler(async (req, res) => {
    req.params.section = 'visite-virtuelle';
    await PublicController.album(req, res);
  }));
  router.post('/contact', verifySameOrigin, verifyCsrf, contactRateLimit, asyncHandler(PublicController.submitContact));
  router.post('/feedback', verifySameOrigin, verifyCsrf, contactRateLimit, asyncHandler(PublicController.submitFeedback));

  router.get('/{*path}', asyncHandler(PublicController.page));

  return router;
}
