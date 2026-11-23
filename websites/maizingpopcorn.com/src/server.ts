import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const siteRoot = path.resolve(process.cwd(), 'site');

dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

const port = Number(process.env.PORT ?? 3094);
const trustProxy = process.env.TRUST_PROXY === '1';

const app = express();

if (trustProxy) {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https://ajax.googleapis.com',
          'https://cdnjs.cloudflare.com',
          'https://maxcdn.bootstrapcdn.com',
          'https://connect.facebook.net'
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://maxcdn.bootstrapcdn.com'
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'https://www.facebook.com', 'https://*.facebook.com'],
        'frame-src': ["'self'", 'https://www.facebook.com', 'https://*.facebook.com'],
        'connect-src': ["'self'", 'https://www.facebook.com', 'https://*.facebook.com'],
        'form-action': ["'self'", 'mailto:']
      }
    }
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get('/', (_req, res) => {
  res.sendFile(path.join(siteRoot, 'default.htm'));
});

app.use(
  express.static(siteRoot, {
    index: false,
    extensions: ['htm', 'html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.htm') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

app.use((_req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.listen(port, () => {
  console.info(`maizingpopcorn.com listening on http://127.0.0.1:${port}`);
});
