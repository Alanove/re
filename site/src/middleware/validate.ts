import type { z } from 'zod';
import { BadRequestError, type FieldErrors } from '../errors/httpError.js';

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form';
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown, message = 'Please correct the highlighted fields.'): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestError(message, toFieldErrors(result.error));
  }
  return result.data;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fields: FieldErrors };

export function safeParseFields<T extends z.ZodType>(schema: T, input: unknown): ParseResult<z.infer<T>> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, fields: toFieldErrors(result.error) };
}
