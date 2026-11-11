import { Request, Response, NextFunction, RequestHandler } from 'express';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function parseId(value: unknown): number | null {
  const id = parseInt(String(value ?? ''), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function requireId(value: unknown, label = 'id'): number {
  const id = parseId(value);
  if (id === null) throw new ApiError(400, `Invalid ${label}`);
  return id;
}

export function parsePagination(query: Request['query'], defaultSize = 25, maxSize = 100): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const requested = parseInt(String(query.pageSize || defaultSize), 10) || defaultSize;
  return { page, pageSize: Math.min(Math.max(1, requested), maxSize) };
}

export function paginate<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
} {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    hasMore: start + pageSize < items.length
  };
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
