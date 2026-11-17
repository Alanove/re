import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message: string;
}

/** Fixed-window, per-IP limiter kept in memory (one Node process per site). */
export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) {
          hits.delete(key);
        }
      }
    }
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > options.limit) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ success: false, message: options.message });
      return;
    }
    next();
  };
}
