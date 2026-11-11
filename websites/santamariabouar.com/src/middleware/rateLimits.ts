import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

function rateLimitHandler(message: string) {
  return (req: Request, res: Response): void => {
    const wantsJson =
      req.xhr || req.headers.accept?.includes('application/json') === true;

    if (wantsJson) {
      res.status(429).json({ success: false, message });
      return;
    }

    res.status(429).send(message);
  };
}

/** Login attempts (admin + member): 10 per 15 minutes per IP */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many login attempts. Please try again in 15 minutes.')
});

/** Access requests: 5 per hour per IP */
export const requestAccessRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many access requests. Please try again later.')
});

/** Forgot / reset password: 5 per hour per IP */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many password reset attempts. Please try again later.')
});

/** Contact form: 5 per 15 minutes per IP */
export const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many messages sent. Please try again in 15 minutes.')
});

/** Main gate open: 6 per 15 minutes per IP */
export const openGateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many gate open attempts. Please try again in a few minutes.')
});
