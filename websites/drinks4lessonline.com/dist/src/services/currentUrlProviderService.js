"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseUrl = getBaseUrl;
exports.redirectToCanonicalUrlMiddleware = redirectToCanonicalUrlMiddleware;
function normalizeBaseUrl(url) {
    let u = url.replace(/\/$/, '').toLowerCase();
    try {
        const parsed = new URL(u.startsWith('http') ? u : 'https://' + u);
        if (parsed.port === '443' && parsed.protocol === 'https:')
            parsed.port = '';
        if (parsed.port === '80' && parsed.protocol === 'http:')
            parsed.port = '';
        return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
    }
    catch {
        return u;
    }
}
function getCanonicalBaseUrl() {
    const fromEnv = process.env.APP_URL?.trim();
    if (!fromEnv)
        return null;
    return normalizeBaseUrl(fromEnv);
}
function getCanonicalHostname() {
    const base = getCanonicalBaseUrl();
    if (!base)
        return null;
    try {
        return new URL(base.startsWith('http') ? base : 'https://' + base).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
function getRequestedHostname(hostHeader) {
    const first = hostHeader.split(',')[0].trim();
    const colon = first.indexOf(':');
    return (colon > 0 ? first.slice(0, colon) : first).toLowerCase();
}
function getBaseUrl(req) {
    const fromEnv = process.env.APP_URL?.trim();
    const envUrl = fromEnv ? fromEnv.replace(/\/$/, '') : '';
    const isProduction = process.env.NODE_ENV === 'production';
    const envIsLocalhost = envUrl.toLowerCase().includes('localhost');
    if (envUrl && !envIsLocalhost) {
        return envUrl;
    }
    if (req) {
        const host = getRequestedHost(req);
        if (host) {
            const protocol = getRequestedProtocol(req);
            const url = `${protocol}://${host}`;
            if (isProduction && url.toLowerCase().includes('localhost')) {
                console.warn(`[url] getBaseUrl: request host is localhost (${url}) in production — returning empty. Check nginx proxy_set_header Host.`);
            }
            else {
                return url;
            }
        }
    }
    if (envUrl) {
        if (isProduction) {
            console.warn(`[url] getBaseUrl: falling back to localhost APP_URL (${envUrl}) in production. Fix APP_URL in .env.production.`);
        }
        return envUrl;
    }
    return '';
}
function getRequestedHost(req) {
    const raw = req.get('x-forwarded-host') || req.get('host') || '';
    const first = typeof raw === 'string' ? raw.split(',')[0].trim() : '';
    return first || '';
}
function getRequestedProtocol(req) {
    const cfVisitor = req.get('cf-visitor');
    if (typeof cfVisitor === 'string' && cfVisitor.trim() !== '') {
        try {
            const obj = JSON.parse(cfVisitor);
            if (obj.scheme === 'https' || obj.scheme === 'http')
                return obj.scheme;
        }
        catch {
        }
    }
    const forwarded = req.get('x-forwarded-proto');
    if (typeof forwarded === 'string' && forwarded.trim() !== '') {
        const p = forwarded.split(',')[0].trim().toLowerCase();
        if (p === 'https' || p === 'http')
            return p;
    }
    return (req.protocol || 'https').toLowerCase();
}
const REDIRECT_DEBUG = process.env.REDIRECT_DEBUG === 'true' || process.env.DEBUG === 'true';
function redirectToCanonicalUrlMiddleware(req, res, next) {
    const canonical = getCanonicalBaseUrl();
    const canonicalHost = getCanonicalHostname();
    const host = getRequestedHost(req);
    const protocol = getRequestedProtocol(req);
    const currentBase = host ? normalizeBaseUrl(`${protocol}://${host}`) : '';
    const requestHostname = host ? getRequestedHostname(host) : '';
    if (REDIRECT_DEBUG) {
        console.log('[redirect] Host=%s X-Forwarded-Host=%s X-Forwarded-Proto=%s → currentBase=%s canonical=%s requestHostname=%s canonicalHost=%s', req.get('host') || '(empty)', req.get('x-forwarded-host') || '(empty)', req.get('x-forwarded-proto') || '(empty)', currentBase || '(no host)', canonical || '(APP_URL not set)', requestHostname || '(none)', canonicalHost || '(none)');
    }
    if (!canonical || !canonicalHost) {
        if (REDIRECT_DEBUG)
            console.log('[redirect] skip: APP_URL not set');
        next();
        return;
    }
    if (!host) {
        if (REDIRECT_DEBUG)
            console.log('[redirect] skip: no host from request');
        next();
        return;
    }
    if (requestHostname === 'localhost' || requestHostname === '127.0.0.1') {
        if (REDIRECT_DEBUG)
            console.log('[redirect] skip: request hostname is localhost (proxy not forwarding Host header)');
        next();
        return;
    }
    if (requestHostname !== canonicalHost) {
        const target = canonical + (req.originalUrl || req.url || '/');
        if (REDIRECT_DEBUG)
            console.log('[redirect] 301 (hostname mismatch) → %s', target);
        res.redirect(301, target);
        return;
    }
    if (currentBase === canonical) {
        if (REDIRECT_DEBUG)
            console.log('[redirect] skip: already canonical');
        next();
        return;
    }
    const target = canonical + (req.originalUrl || req.url || '/');
    if (REDIRECT_DEBUG)
        console.log('[redirect] 301 (protocol/base mismatch) → %s', target);
    res.redirect(301, target);
}
//# sourceMappingURL=currentUrlProviderService.js.map