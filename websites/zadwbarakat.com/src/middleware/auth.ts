import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/httpError.js';
import { usersService } from '../services/usersService.js';
import { asyncHandler } from './asyncHandler.js';

function wantsJson(req: Request): boolean {
  return req.path.startsWith('/api/') || req.xhr || (req.get('accept') ?? '').includes('application/json') || req.method === 'DELETE';
}

export const loadCurrentUser = asyncHandler(async (req, res, next) => {
  const userId = req.session.userId;
  if (userId !== undefined) {
    const user = await usersService.findActive(userId);
    if (user) {
      req.currentUser = user;
      res.locals.currentUser = user;
    } else {
      delete req.session.userId;
    }
  }
  next();
});

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.currentUser) {
    next();
    return;
  }
  if (wantsJson(req)) {
    next(new UnauthorizedError('Your session has expired. Sign in again.'));
    return;
  }
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }
  res.redirect('/admin/login');
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.currentUser?.role === 'admin') {
    next();
    return;
  }
  next(new ForbiddenError('Only administrators can manage this area.'));
}
