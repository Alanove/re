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
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com'],
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

type LimiterOptions = Omit<Partial<Options>, 'message' | 'windowMs' | 'limit'> & {
  windowMs: number;
  limit: number;
  message: string;
};

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

const STATIC_PREFIXES = ['/css/', '/js/', '/img/', '/Assets/', '/fonts/', '/favicon', '/captcha/captcha'];

export const globalRateLimit = limiter({
  windowMs: 60_000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again in a minute.',
  skip: (req) => STATIC_PREFIXES.some((prefix) => req.path.startsWith(prefix))
});

export const contactRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 5,
  message: 'Too many messages from this connection. Please wait a few minutes and try again.'
});

export const captchaChallengeRateLimit = limiter({
  windowMs: 60_000,
  limit: 30,
  message: 'Too many verification requests. Please wait a minute and try again.'
});
