import { Router } from 'express';
import { CaptchaController } from '../controllers/captchaController.js';
import { PublicController } from '../controllers/publicController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { legacyRedirects } from '../middleware/redirects.js';
import { captchaChallengeRateLimit } from '../middleware/security.js';
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
  router.get('/{*path}', asyncHandler(PublicController.page));

  return router;
}
