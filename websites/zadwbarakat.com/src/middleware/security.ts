import type { RequestHandler } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import helmet from 'helmet';
import { isProduction } from '../config/env.js';
import { HttpError } from '../errors/httpError.js';

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://www.google.com'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

type LimiterOptions = Omit<Partial<Options>, 'message' | 'windowMs' | 'limit'> & { windowMs: number; limit: number; message: string };

function limiter(options: LimiterOptions): RequestHandler {
  const { message, ...rest } = options;
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...rest,
    handler: (_req, _res, next) => {
      next(new HttpError(429, message));
    }
  });
}

const STATIC_PREFIXES = ['/css/', '/js/', '/fonts/', '/icons/', '/uploads/', '/admin/css/', '/admin/js/', '/admin/editor/', '/admin/table-sort/', '/admin/webfonts/', '/favicon'];

export const globalRateLimit = limiter({
  windowMs: 60_000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again in a minute.',
  skip: (req) => STATIC_PREFIXES.some((prefix) => req.path.startsWith(prefix))
});

export const loginRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.'
});

export const contactRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 5,
  message: 'Too many messages from this connection. Please wait a few minutes and try again.'
});

export const newsletterRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 5,
  message: 'محاولات كثيرة. يرجى المحاولة بعد بضع دقائق.'
});

export const suggestRateLimit = limiter({
  windowMs: 60_000,
  limit: 90,
  message: 'Too many search requests. Please slow down.'
});

export const adminWriteRateLimit = limiter({
  windowMs: 60_000,
  limit: 120,
  message: 'Too many changes in a short time. Please wait a minute.',
  skip: (req) => req.method === 'GET' || req.method === 'HEAD'
});
