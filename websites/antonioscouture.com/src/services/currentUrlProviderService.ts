import { Request, Response, NextFunction } from 'express';

/** Normalize base URL: lowercase, no trailing slash, default ports removed (e.g. :443 for https). */
function normalizeBaseUrl(url: string): string {
  let u = url.replace(/\/$/, '').toLowerCase();
  try {
    const parsed = new URL(u.startsWith('http') ? u : 'https://' + u);
    if (parsed.port === '443' && parsed.protocol === 'https:') parsed.port = '';
    if (parsed.port === '80' && parsed.protocol === 'http:') parsed.port = '';
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
  } catch {
    return u;
  }
}

/** Normalized canonical base URL from APP_URL (no trailing slash, lowercase, default ports stripped). */
function getCanonicalBaseUrl(): string | null {
  const fromEnv = process.env.APP_URL?.trim();
  if (!fromEnv) return null;
  return normalizeBaseUrl(fromEnv);
}

/** Canonical hostname only (e.g. guerrasports.com) from APP_URL, or null. */
function getCanonicalHostname(): string | null {
  const base = getCanonicalBaseUrl();
  if (!base) return null;
  try {
    return new URL(base.startsWith('http') ? base : 'https://' + base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Request hostname (strip port). */
function getRequestedHostname(hostHeader: string): string {
  const first = hostHeader.split(',')[0].trim();
  const colon = first.indexOf(':');
  return (colon > 0 ? first.slice(0, colon) : first).toLowerCase();
}

/**
 * Returns the application base URL for building absolute links (e.g. checkout return URLs).
 * Priority:
 *  1. APP_URL from env (when set and not a localhost URL) — always preferred.
 *  2. Current request's protocol + host header (browser URL, when request available).
 *  3. APP_URL even if localhost (last resort, development only).
 * In production we never return a localhost URL.
 */
export function getBaseUrl(req?: Request): string {
  const fromEnv = process.env.APP_URL?.trim();
  const envUrl = fromEnv ? fromEnv.replace(/\/$/, '') : '';
  const isProduction = process.env.NODE_ENV === 'production';
  const envIsLocalhost = envUrl.toLowerCase().includes('localhost');

  // 1. Prefer APP_URL when it's set and not a localhost URL (production-safe)
  if (envUrl && !envIsLocalhost) {
    return envUrl;
  }

  // 2. Fall back to the request host (browser-visible URL via nginx/proxy headers)
  if (req) {
    const host = getRequestedHost(req);
    if (host) {
      const protocol = getRequestedProtocol(req);
      const url = `${protocol}://${host}`;
      if (isProduction && url.toLowerCase().includes('localhost')) {
        console.warn(`[url] getBaseUrl: request host is localhost (${url}) in production — returning empty. Check nginx proxy_set_header Host.`);
        // Fall through to APP_URL localhost fallback below
      } else {
        return url;
      }
    }
  }

  // 3. Last resort: return APP_URL even if it is localhost (development only)
  if (envUrl) {
    if (isProduction) {
      console.warn(`[url] getBaseUrl: falling back to localhost APP_URL (${envUrl}) in production. Fix APP_URL in .env.production.`);
    }
    return envUrl;
  }

  return '';
}

/**
 * Resolve the host the user's browser requested.
 * Order: X-Forwarded-Host (set by nginx) → Host.
 * Nginx (behind Cloudflare) should pass the original host, e.g.:
 *   proxy_set_header Host $host;
 *   proxy_set_header X-Forwarded-Host $host;
 *   proxy_set_header X-Forwarded-Proto $scheme;
 */
function getRequestedHost(req: Request): string {
  const raw = req.get('x-forwarded-host') || req.get('host') || '';
  const first = typeof raw === 'string' ? raw.split(',')[0].trim() : '';
  return first || '';
}

/**
 * Resolve the protocol the user's browser used (http vs https).
 * Order: CF-Visitor (Cloudflare JSON), X-Forwarded-Proto (nginx), req.protocol.
 */
function getRequestedProtocol(req: Request): string {
  const cfVisitor = req.get('cf-visitor');
  if (typeof cfVisitor === 'string' && cfVisitor.trim() !== '') {
    try {
      const obj = JSON.parse(cfVisitor) as { scheme?: string };
      if (obj.scheme === 'https' || obj.scheme === 'http') return obj.scheme;
    } catch {
      /* ignore */
    }
  }
  const forwarded = req.get('x-forwarded-proto');
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    const p = forwarded.split(',')[0].trim().toLowerCase();
    if (p === 'https' || p === 'http') return p;
  }
  return (req.protocol || 'https').toLowerCase();
}

const REDIRECT_DEBUG = process.env.REDIRECT_DEBUG === 'true' || process.env.DEBUG === 'true';

/**
 * Middleware: when APP_URL is set, redirect any request whose host/protocol does not
 * match APP_URL to the same path on the canonical URL (e.g. guerrasports.liteweb.info → guerrasports.com).
 * Uses X-Forwarded-Host, X-Forwarded-Proto, and Cloudflare's CF-Visitor so it works behind Cloudflare + nginx.
 * Set REDIRECT_DEBUG=true (or DEBUG=true) and restart to log why redirect did or didn't run.
 */
export function redirectToCanonicalUrlMiddleware(req: Request, res: Response, next: NextFunction): void {
  const canonical = getCanonicalBaseUrl();
  const canonicalHost = getCanonicalHostname();
  const host = getRequestedHost(req);
  const protocol = getRequestedProtocol(req);
  const currentBase = host ? normalizeBaseUrl(`${protocol}://${host}`) : '';
  const requestHostname = host ? getRequestedHostname(host) : '';

  if (REDIRECT_DEBUG) {
    console.log(
      '[redirect] Host=%s X-Forwarded-Host=%s X-Forwarded-Proto=%s → currentBase=%s canonical=%s requestHostname=%s canonicalHost=%s',
      req.get('host') || '(empty)',
      req.get('x-forwarded-host') || '(empty)',
      req.get('x-forwarded-proto') || '(empty)',
      currentBase || '(no host)',
      canonical || '(APP_URL not set)',
      requestHostname || '(none)',
      canonicalHost || '(none)'
    );
  }

  if (!canonical || !canonicalHost) {
    if (REDIRECT_DEBUG) console.log('[redirect] skip: APP_URL not set');
    next();
    return;
  }
  if (!host) {
    if (REDIRECT_DEBUG) console.log('[redirect] skip: no host from request');
    next();
    return;
  }

  // Safety: if the detected request hostname is localhost or 127.0.0.1, we are behind a proxy
  // that is NOT forwarding the original Host header (e.g. nginx without proxy_set_header Host $host).
  // We cannot determine the real external hostname → skip the redirect to avoid an infinite loop.
  // The canonical redirect should be enforced at the nginx/Cloudflare level in this case.
  if (requestHostname === 'localhost' || requestHostname === '127.0.0.1') {
    if (REDIRECT_DEBUG) console.log('[redirect] skip: request hostname is localhost (proxy not forwarding Host header)');
    next();
    return;
  }

  if (requestHostname !== canonicalHost) {
    const target = canonical + (req.originalUrl || req.url || '/');
    if (REDIRECT_DEBUG) console.log('[redirect] 301 (hostname mismatch) → %s', target);
    res.redirect(301, target);
    return;
  }
  if (currentBase === canonical) {
    if (REDIRECT_DEBUG) console.log('[redirect] skip: already canonical');
    next();
    return;
  }
  const target = canonical + (req.originalUrl || req.url || '/');
  if (REDIRECT_DEBUG) console.log('[redirect] 301 (protocol/base mismatch) → %s', target);
  res.redirect(301, target);
}
