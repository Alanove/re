import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { isProduction } from '../config/env.js';
import { HttpError, NotFoundError } from '../errors/httpError.js';
import { siteLocals } from './siteLocals.js';

function normalize(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'One of the files is too large (images up to 8 MB, documents up to 20 MB, videos up to 25 MB, audio up to 30 MB).' : 'The upload could not be processed.';
    return new HttpError(400, message);
  }
  const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
  if (status === 400 && (error as { type?: string }).type === 'entity.parse.failed') {
    return new HttpError(400, 'The request body is not valid.');
  }
  if (status === 413) {
    return new HttpError(413, 'The request is too large.');
  }
  return new HttpError(500, 'Something went wrong on our side.', { expose: false, cause: error });
}

function wantsJson(req: Request): boolean {
  const accept = req.get('accept') ?? '';
  return (
    req.path.includes('/api/') ||
    req.xhr ||
    req.method === 'DELETE' ||
    req.is('application/json') === 'application/json' ||
    (accept.includes('application/json') && !accept.includes('text/html'))
  );
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`No page exists at ${req.path}.`));
}

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  const httpError = normalize(error);
  if (httpError.status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  const message = httpError.expose ? httpError.message : 'Something went wrong on our side. Please try again later.';
  res.status(httpError.status);

  if (wantsJson(req)) {
    res.json({ success: false, message, ...(httpError.fields ? { fields: httpError.fields } : {}) });
    return;
  }

  const isAdmin = req.originalUrl.startsWith('/admin');
  const view = isAdmin ? 'admin-error' : 'error';
  const publicMessage =
    httpError.status === 404 ? 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.' : httpError.status >= 500 ? 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.' : message;
  const locals = {
    status: httpError.status,
    message: isAdmin ? message : publicMessage,
    title: isAdmin ? (httpError.status === 404 ? 'Page not found' : 'Something went wrong') : httpError.status === 404 ? 'الصفحة غير موجودة' : 'عذراً',
    detail: !isProduction && httpError.status >= 500 && error instanceof Error ? error.stack ?? '' : ''
  };
  const renderView = (): void => {
    res.render(view, { ...locals, layout: isAdmin ? 'admin-layout' : 'layout' }, (renderError, html) => {
      if (renderError) {
        console.error('Error view failed to render', renderError);
        res.type('text/plain').send(`${httpError.status} ${message}`);
        return;
      }
      res.send(html);
    });
  };

  if (isAdmin || res.locals.settings) {
    renderView();
    return;
  }
  siteLocals(req, res, (localsError?: unknown) => {
    if (localsError) {
      console.error('Site locals failed while rendering an error page', localsError);
      res.type('text/plain').send(`${httpError.status} ${message}`);
      return;
    }
    renderView();
  });
}
