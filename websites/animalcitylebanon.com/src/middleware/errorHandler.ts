import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/httpError.js';

function normalize(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
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

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).type('text/plain').send(`No page exists at ${req.path}.`);
}

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  const httpError = normalize(error);
  if (httpError.status >= 500 && !httpError.expose) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  const message = httpError.expose ? httpError.message : 'Something went wrong on our side. Please try again later.';
  res.status(httpError.status).json({
    success: false,
    message,
    ...(httpError.fields ? { fields: httpError.fields } : {})
  });
}
