import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse';

function limiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, message)
  });
}

/** Mobile login: replaces reCAPTCHA, which native apps cannot show. */
export const apiLoginRateLimiter = limiter(15 * 60 * 1000, 10, 'Too many login attempts. Please try again in 15 minutes.');

export const apiRefreshRateLimiter = limiter(15 * 60 * 1000, 60, 'Too many requests. Please try again later.');

export const apiForgotPasswordRateLimiter = limiter(60 * 60 * 1000, 5, 'Too many password reset attempts. Please try again later.');

export const apiRequestAccessRateLimiter = limiter(60 * 60 * 1000, 5, 'Too many access requests. Please try again later.');

export const apiGeneralRateLimiter = limiter(60 * 1000, 120, 'Too many requests. Please slow down.');
