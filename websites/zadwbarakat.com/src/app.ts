import path from 'node:path';
import compression from 'compression';
import express, { type Express } from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import { env, isProduction } from './config/env.js';
import { PATHS } from './config/paths.js';
import type { TransformConfig } from './config/transform.js';
import { encodePath } from './lib/paths.js';
import { loadCurrentUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimit, securityHeaders } from './middleware/security.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { createPublicRouter } from './routes/publicRoutes.js';
import { arabicCount } from './services/format.js';

const MemoryStore = createMemoryStore(session);
const DAY_MS = 24 * 60 * 60 * 1000;

export function createApp(config: TransformConfig): Express {
  const app = express();
  const sessionCookieName = `${config.siteKey}.sid`;

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('view engine', 'ejs');
  app.set('views', [PATHS.views, PATHS.adminViews]);
  app.set('layout', 'layout');
  app.locals.sessionCookieName = sessionCookieName;
  app.locals.siteKey = config.siteKey;
  app.locals.assetVersion = Date.now().toString(36);
  app.locals.encodePath = encodePath;
  app.locals.arabicCount = arabicCount;

  app.use(securityHeaders());
  app.use(compression({ threshold: 1024 }));
  app.use(globalRateLimit);

  const staticOptions = { maxAge: isProduction ? '7d' : 0, index: false, dotfiles: 'ignore' as const };
  app.use('/fonts', express.static(path.join(PATHS.public, 'fonts'), { ...staticOptions, maxAge: isProduction ? '365d' : 0, immutable: isProduction }));
  app.use(express.static(PATHS.public, staticOptions));
  app.use('/admin', express.static(PATHS.adminPublic, staticOptions));

  app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    session({
      name: sessionCookieName,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: new MemoryStore({ checkPeriod: DAY_MS }),
      cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 8 * 60 * 60 * 1000 }
    })
  );

  app.use(expressLayouts);
  app.use(loadCurrentUser);

  app.use('/admin', createAdminRouter());
  app.use(createPublicRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
