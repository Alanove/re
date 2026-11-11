// Load environment variables FIRST before anything else
import './config/setup-env';

// Polyfill for File API (Node.js 18 compatibility with undici)
if (typeof globalThis.File === 'undefined') {
  // File API polyfill for Node.js 18 compatibility
  // This is needed because undici expects File to be available
  (globalThis as any).File = class File {
    name: string;
    lastModified: number;
    size: number;
    type: string;
    webkitRelativePath: string;

    constructor(bits: any[] = [], name: string = '', options: any = {}) {
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
      this.size = 0;
      this.type = options.type || '';
      this.webkitRelativePath = options.webkitRelativePath || '';
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
      return new Blob();
    }

    stream(): any {
      // Return a minimal stream-like object
      return {
        getReader: () => ({ read: () => Promise.resolve({ done: true, value: undefined }) })
      };
    }

    text(): Promise<string> {
      return Promise.resolve('');
    }

    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0));
    }
  };

  // Also ensure Blob exists if File depends on it
  if (typeof globalThis.Blob === 'undefined') {
    (globalThis as any).Blob = class Blob {
      constructor(public bits: any[] = [], public options: any = {}) { }
      size: number = 0;
      type: string = '';
      slice(start?: number, end?: number, contentType?: string): Blob {
        return new Blob();
      }
    };
  }
}

// Trigger restart for i18n (restarting to pick up EJS fixes.......)
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import pagesService from './services/pagesService';
import paymentService from './services/paymentService';
import securityService from './services/securityService';
import middlewareService from './services/middlewareService';
import { redirectToCanonicalUrlMiddleware } from './services/currentUrlProviderService';
import { configureRoutes, configure404Handler } from './routes/index';
import { envConfig } from './config/env.config';
import { usersService } from '../admin/services/usersService';
import { attachChatSocket } from './services/chatSocketService';

const app = express();

// Trust proxy: 2 = Cloudflare (orange cloud ON) + nginx.
// Express trusts X-Forwarded-* headers so req.protocol/req.ip are correct.
// www→non-www redirect is handled by nginx directly, so this only affects
// normal requests to guerrasports.com.
app.set('trust proxy', 2);

// When APP_URL is set, redirect any other host/protocol to the canonical URL
const canonicalRedirectUrl = process.env.APP_URL?.trim();
if (canonicalRedirectUrl) {
  console.log(`Canonical URL redirect: enabled → ${canonicalRedirectUrl.replace(/\/$/, '')}`);
} else {
  console.log(
    'Canonical URL redirect: disabled (APP_URL not set). NODE_ENV=%s — ensure .env.production exists in project root and you start with npm run start:prod',
    process.env.NODE_ENV || '(not set)'
  );
}
app.use(redirectToCanonicalUrlMiddleware);

// Get the project root directory dynamically
const getProjectRoot = () => {
  // If running from dist directory, go up to project root
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../../');
  }
  // If running from src directory (development), go up to project root
  return path.resolve(__dirname, '../');
};

const projectRoot = getProjectRoot();

// Configure Express view engine and static files
app.set('view engine', 'ejs');
app.set('views', [
  path.join(projectRoot, 'views'),
  path.join(projectRoot, 'admin/views')
]);

const STATIC_CACHE_MS = 365 * 24 * 60 * 60 * 1000;
const UPLOADS_CACHE_SEC = 7 * 24 * 60 * 60;

/**
 * express.static's default mime for .mp4 is often application/mp4. Browsers need video/mp4 for
 * <video> and inline playback, and with helmet's X-Content-Type-Options: nosniff, wrong
 * application/* types are not sniffed and the file may only download.
 */
const STATIC_VIDEO_EXT_TO_TYPE: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

function setPublicStaticHeaders(res: express.Response, filePath: string): void {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/uploads/')) {
    res.setHeader('Cache-Control', `public, max-age=${UPLOADS_CACHE_SEC}`);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  const ext = path.extname(filePath).toLowerCase();
  const videoType = STATIC_VIDEO_EXT_TO_TYPE[ext];
  if (videoType) {
    res.setHeader('Content-Type', videoType);
    res.setHeader('Content-Disposition', 'inline');
  }
}

app.use(
  express.static(path.join(projectRoot, 'public'), {
    maxAge: STATIC_CACHE_MS,
    setHeaders: setPublicStaticHeaders,
  })
);
app.use(
  '/admin',
  express.static(path.join(projectRoot, 'admin/public'), {
    maxAge: STATIC_CACHE_MS,
    setHeaders(res: express.Response, filePath: string) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      const ext = path.extname(filePath).toLowerCase();
      const videoType = STATIC_VIDEO_EXT_TO_TYPE[ext];
      if (videoType) {
        res.setHeader('Content-Type', videoType);
        res.setHeader('Content-Disposition', 'inline');
      }
    },
  })
);
app.use(expressLayouts);
app.set('layout', 'layout');

// Configure security (helmet, session) - BEFORE body parser
securityService.configureHelmet(app);
securityService.configureSession(app);
securityService.configureCookieSecureMiddleware(app);
securityService.configureSessionDebugMiddleware(app);

// Body parser middleware (must be before CSRF)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure CSRF protection - AFTER body parser
securityService.configureCsrfProtection(app);
securityService.configureCsrfTokenInJsonResponse(app);
securityService.configureCsrfErrorHandler(app);

// Configure general middleware (pages, SEO, site settings)
middlewareService.configureGeneralMiddleware(app);

// Configure all routes
configureRoutes(app);

// Configure 404 handler
configure404Handler(app);

const PORT = envConfig.port;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize pagesService cache (this will create the connection pool)
    await pagesService.initialize();
    console.log('✅ Database and cache initialized');

    // Initialize payment methods if they don't exist
    try {
      await paymentService.initializeDefaultPaymentMethods();
      console.log('✅ Payment methods initialized');
    } catch (error) {
      console.warn('⚠️  Warning: Could not initialize payment methods:', error);
      // Don't fail startup if payment methods already exist
    }

    if (envConfig.devAdminBootstrapEnabled) {
      try {
        await usersService.ensureDevBootstrapUser({
          email: envConfig.devAdminEmail,
          password: envConfig.devAdminPassword,
          displayName: envConfig.devAdminName,
        });
        console.log('✅ Dev admin user ready (credentials match Dev Login button)');
      } catch (error) {
        console.warn(
          '⚠️  Dev admin bootstrap failed (database or users table?):',
          error
        );
      }
    }

    if (envConfig.useHttps && !(envConfig.httpsKeyPath && envConfig.httpsCertPath)) {
      console.warn('⚠️  USE_HTTPS is set but HTTPS_KEY_PATH and HTTPS_CERT_PATH are required. Starting HTTP server.');
    }
    const sessionMw = securityService.getSessionMiddleware();

    if (envConfig.useHttps && envConfig.httpsKeyPath && envConfig.httpsCertPath) {
      const keyPath = path.isAbsolute(envConfig.httpsKeyPath)
        ? envConfig.httpsKeyPath
        : path.join(projectRoot, envConfig.httpsKeyPath);
      const certPath = path.isAbsolute(envConfig.httpsCertPath)
        ? envConfig.httpsCertPath
        : path.join(projectRoot, envConfig.httpsCertPath);
      const httpsOptions = {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8'),
      };
      const server = https.createServer(httpsOptions, app);
      attachChatSocket(server, sessionMw);
      server.listen(PORT, () => {
        console.log(`✅ HTTPS server running on https://localhost:${PORT}`);
      });
    } else {
      const server = http.createServer(app);
      attachChatSocket(server, sessionMw);
      server.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 