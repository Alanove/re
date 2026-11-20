import type { Request, Response } from 'express';
import type { z } from 'zod';
import { HttpError, type FieldErrors } from '../../errors/httpError.js';
import { parseOrThrow } from '../../middleware/validate.js';

export type FlashType = 'success' | 'danger' | 'warning' | 'info';

export function setFlash(req: Request, type: FlashType, message: string): void {
  req.session.flash = { type, message };
}

export function params<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return parseOrThrow(schema, req.params, 'The address is not valid.');
}

export function formErrorState(error: unknown): { message: string; fields: FieldErrors } | null {
  if (error instanceof HttpError && error.status < 500) {
    return { message: error.message, fields: error.fields ?? {} };
  }
  return null;
}

export function currentUserId(req: Request): number {
  const id = req.currentUser?.id;
  if (id === undefined) {
    throw new HttpError(401, 'Authentication is required.');
  }
  return id;
}

export function render(res: Response, view: string, locals: Record<string, unknown>): void {
  res.render(view, { layout: 'admin-layout', errors: {}, error: null, ...locals });
}
