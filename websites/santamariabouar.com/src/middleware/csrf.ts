import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const CSRF_SESSION_KEY = 'csrfToken';

function getSessionCsrf(req: Request): string | undefined {
  return (req.session as any)?.[CSRF_SESSION_KEY];
}

function setSessionCsrf(req: Request, token: string): void {
  (req.session as any)[CSRF_SESSION_KEY] = token;
}

/**
 * Ensure a CSRF token exists on the session and expose it to views.
 * Persists the session immediately when a new token is created so the
 * Set-Cookie header is always issued before the login form is rendered.
 */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    next();
    return;
  }

  let token = getSessionCsrf(req);
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    setSessionCsrf(req, token);
    req.session.save((err) => {
      if (err) {
        console.error('Failed to persist CSRF session:', err);
      }
      res.locals.csrfToken = token;
      next();
    });
    return;
  }

  res.locals.csrfToken = token;
  next();
}

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validate CSRF token from body (or header) against the session token.
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  const expected = getSessionCsrf(req);
  const provided =
    (typeof req.body?._csrf === 'string' && req.body._csrf) ||
    (typeof req.headers['x-csrf-token'] === 'string' && req.headers['x-csrf-token']) ||
    '';

  if (!expected || !provided || !tokensMatch(expected, provided)) {
    const hasSessionCookie = Boolean(req.headers.cookie && /(?:^|;\s*)smb\.sid=/.test(req.headers.cookie));
    console.warn(
      `[csrf] Rejected ${req.method} ${req.originalUrl} ` +
        `(sessionCookie=${hasSessionCookie}, hasExpected=${Boolean(expected)}, hasProvided=${Boolean(provided)}, secure=${req.secure}, proto=${req.headers['x-forwarded-proto'] || 'none'})`
    );

    const wantsJson =
      req.xhr || req.headers.accept?.includes('application/json') === true;

    if (wantsJson) {
      res.status(403).json({ success: false, message: 'Invalid or missing security token. Please refresh and try again.' });
      return;
    }

    // Prefer redirecting back to the form so the user gets a fresh token + cookie
    const referer = typeof req.headers.referer === 'string' ? req.headers.referer : '';
    if (referer.includes('/admin/login') || req.path.startsWith('/admin')) {
      res.redirect(303, '/admin/login?error=' + encodeURIComponent('Session expired. Please try logging in again.'));
      return;
    }
    if (referer.includes('/account/login') || req.path.startsWith('/account')) {
      res.redirect(303, '/account/login?error=' + encodeURIComponent('Session expired. Please try logging in again.'));
      return;
    }

    res.status(403).send('Invalid or missing security token. Please go back, refresh the page, and try again.');
    return;
  }

  next();
}
