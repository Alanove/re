import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function readSubmittedToken(req: Request): string {
  const header = req.get('x-csrf-token');
  if (header) {
    return header;
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body._csrf === 'string') {
    return body._csrf;
  }
  const query = req.query._csrf;
  return typeof query === 'string' ? query : '';
}

function tokensMatch(expected: string, submitted: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const expected = req.session.csrfToken;
  const submitted = readSubmittedToken(req);
  if (!expected || !submitted || !tokensMatch(expected, submitted)) {
    next(new HttpError(403, 'Your session expired or the form is out of date. Reload the page and try again.'));
    return;
  }
  next();
}

export function verifySameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin') ?? req.get('referer') ?? '';
  if (!origin) {
    next();
    return;
  }
  try {
    const host = new URL(origin).host;
    if (host === req.get('host')) {
      next();
      return;
    }
  } catch {
    next(new HttpError(403, 'Cross-site form submissions are not allowed.'));
    return;
  }
  next(new HttpError(403, 'Cross-site form submissions are not allowed.'));
}
