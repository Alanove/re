import path from 'node:path';
import express, { type Express } from 'express';
import { env, isProduction } from './config/env.js';
import { CaptchaController } from './controllers/captchaController.js';
import { ContactController } from './controllers/contactController.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { verifySameOrigin } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { captchaChallengeRateLimit, contactRateLimit, globalRateLimit, securityHeaders } from './middleware/security.js';

const publicRoot = path.resolve(process.cwd(), 'public');

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(securityHeaders());
  app.use(globalRateLimit);

  app.use(
    express.static(publicRoot, {
      maxAge: isProduction ? '7d' : 0,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    })
  );

  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicRoot, 'index.html'));
  });

  app.get('/captcha/challenge', captchaChallengeRateLimit, CaptchaController.challenge);
  app.post('/contact', verifySameOrigin, contactRateLimit, asyncHandler(ContactController.submit));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
