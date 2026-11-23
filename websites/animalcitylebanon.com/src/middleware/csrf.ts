import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
