"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityService = exports.SecurityService = void 0;
const helmet_1 = __importDefault(require("helmet"));
const express_session_1 = __importDefault(require("express-session"));
const express_mysql_session_1 = __importDefault(require("express-mysql-session"));
const csrf = require('csurf');
const env_config_1 = require("../config/env.config");
const cspService_1 = require("./cspService");
const database_1 = __importDefault(require("../config/database"));
class SecurityService {
    constructor() {
        this.csrfProtection = csrf();
    }
    static getInstance() {
        if (!SecurityService.instance) {
            SecurityService.instance = new SecurityService();
        }
        return SecurityService.instance;
    }
    configureHelmet(app) {
        const isProduction = env_config_1.envConfig.nodeEnv === 'production';
        app.use((0, helmet_1.default)({
            frameguard: {
                action: 'deny'
            },
            noSniff: true,
            hsts: isProduction ? {
                maxAge: process.env.HSTS_MAX_AGE ? parseInt(process.env.HSTS_MAX_AGE, 10) : 31536000,
                includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true' || process.env.HSTS_INCLUDE_SUBDOMAINS === undefined,
                preload: process.env.HSTS_PRELOAD === 'true'
            } : false,
            contentSecurityPolicy: (0, cspService_1.getCspConfig)(isProduction)
        }));
    }
    configureSession(app) {
        const isProduction = env_config_1.envConfig.nodeEnv === 'production';
        const sessionConfig = {
            secret: env_config_1.envConfig.sessionSecret,
            resave: false,
            saveUninitialized: true,
            name: 'connect.sid',
            cookie: {
                secure: isProduction,
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            }
        };
        if (env_config_1.envConfig.cookieDomain && env_config_1.envConfig.cookieDomain.trim() !== '') {
            sessionConfig.cookie.domain = env_config_1.envConfig.cookieDomain;
            console.log(`[SESSION CONFIG] Cookie domain set to: ${env_config_1.envConfig.cookieDomain}`);
        }
        else {
            console.log(`[SESSION CONFIG] Cookie domain not set (using default - current host only)`);
        }
        const MySQLStore = (0, express_mysql_session_1.default)(express_session_1.default);
        const sessionStore = new MySQLStore({
            expiration: 24 * 60 * 60 * 1000,
            createDatabaseTable: true,
            clearExpired: true,
            checkExpirationInterval: 30 * 60 * 1000,
        }, database_1.default.getPool());
        sessionConfig.store = sessionStore;
        console.log(`[SESSION CONFIG] Session cookie secure flag: ${sessionConfig.cookie.secure} (${isProduction ? 'PRODUCTION - HTTPS required' : 'DEVELOPMENT - HTTP allowed'})`);
        console.log(`[SESSION CONFIG] Trust proxy: ${app.get('trust proxy')} (HTTPS detection via X-Forwarded-Proto header)`);
        console.log('[SESSION CONFIG] Using MySQL session store (sessions table)');
        app.use((0, express_session_1.default)(sessionConfig));
    }
    configureCookieSecureMiddleware(app) {
        const isProduction = env_config_1.envConfig.nodeEnv === 'production';
        app.use((req, res, next) => {
            if (req.session && req.session.cookie) {
                const referer = req.get('referer');
                const isSecureFromReferer = !!(referer && referer.startsWith('https://'));
                const isSecure = !!(req.secure || req.get('x-forwarded-proto') === 'https' || (isProduction && isSecureFromReferer));
                const shouldBeSecure = isProduction ? (isSecure || isSecureFromReferer) : isSecure;
                const currentSecure = req.session.cookie.secure === true || req.session.cookie.secure === 'auto';
                if (currentSecure !== shouldBeSecure) {
                    if (isProduction && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
                        console.log(`[SESSION] Updating cookie secure flag: ${currentSecure} -> ${shouldBeSecure} (protocol: ${req.protocol || 'unknown'}, referer: ${referer ? 'https' : 'http'})`);
                    }
                    req.session.cookie.secure = shouldBeSecure;
                    req.session.save((err) => {
                        if (err) {
                            console.error('[SESSION] Error saving session after secure flag update:', err);
                        }
                    });
                }
            }
            next();
        });
    }
    configureSessionDebugMiddleware(app) {
        const isProduction = env_config_1.envConfig.nodeEnv === 'production';
        const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
        if (isProduction && debugOn) {
            app.use((req, res, next) => {
                if (req.path.startsWith('/admin/login')) {
                    const sessionCookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('connect.sid='));
                    const forwardedProto = req.get('x-forwarded-proto');
                    const forwardedFor = req.get('x-forwarded-for');
                    let cookieSessionId = 'none';
                    if (sessionCookie) {
                        try {
                            const cookieValue = decodeURIComponent(sessionCookie.split('=')[1]);
                            const sessionIdMatch = cookieValue.match(/^s:(.+?)\./);
                            if (sessionIdMatch) {
                                cookieSessionId = sessionIdMatch[1].substring(0, 15) + '...';
                            }
                            else {
                                cookieSessionId = cookieValue.substring(0, 15) + '...';
                            }
                        }
                        catch (e) {
                            cookieSessionId = 'parse error';
                        }
                    }
                    if (process.env.DEBUG === 'true' || process.env.DEBUG === '1')
                        console.log(`[SESSION DEBUG] ${req.method} ${req.path}`, {
                            hasSession: !!req.session,
                            sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
                            cookieSessionId: cookieSessionId,
                            sessionIdsMatch: req.sessionID && cookieSessionId !== 'none' ?
                                req.sessionID.substring(0, 15) === cookieSessionId.substring(0, 15) : false,
                            cookieInRequest: sessionCookie ? sessionCookie.substring(0, 50) + '...' : 'none',
                            protocol: req.protocol,
                            secure: req.secure,
                            host: req.get('host'),
                            cookieDomain: env_config_1.envConfig.cookieDomain || 'not set',
                            xForwardedProto: forwardedProto || 'not set',
                            xForwardedFor: forwardedFor || 'not set',
                            trustProxy: app.get('trust proxy'),
                            cookieSecure: req.session?.cookie?.secure,
                            cookieHttpOnly: req.session?.cookie?.httpOnly
                        });
                    const originalEnd = res.end;
                    res.end = function (chunk, encoding) {
                        const setCookieHeader = res.getHeader('Set-Cookie');
                        if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
                            if (setCookieHeader) {
                                console.log(`[SESSION DEBUG] Set-Cookie header sent:`, {
                                    setCookie: Array.isArray(setCookieHeader) ? setCookieHeader[0]?.substring(0, 50) + '...' : String(setCookieHeader).substring(0, 50) + '...'
                                });
                            }
                            else {
                                console.log(`[SESSION DEBUG] WARNING: No Set-Cookie header in response`);
                            }
                        }
                        return originalEnd.call(this, chunk, encoding);
                    };
                }
                next();
            });
        }
    }
    getCsrfTokenFromRequest(req) {
        if (req.body && req.body._csrf) {
            return req.body._csrf;
        }
        const headerToken = req.headers['x-csrf-token'] || req.headers['csrf-token'] || req.headers['xsrf-token'];
        if (headerToken && typeof headerToken === 'string') {
            return headerToken;
        }
        return null;
    }
    configureCsrfProtection(app) {
        app.use((req, res, next) => {
            if (req.method === 'OPTIONS') {
                return next();
            }
            const isMultipart = req.get('content-type')?.includes('multipart/form-data');
            if (isMultipart && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
                try {
                    if (typeof req.csrfToken === 'function') {
                        res.locals.csrfToken = req.csrfToken();
                    }
                    else {
                        res.locals.csrfToken = '';
                    }
                }
                catch (tokenErr) {
                    res.locals.csrfToken = '';
                }
                req._skipCsrfValidation = true;
                return next();
            }
            this.csrfProtection(req, res, (err) => {
                if (err && err.code === 'EBADCSRFTOKEN') {
                    if (req.path.startsWith('/admin/login') && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
                        console.log(`[CSRF DEBUG] Validation FAILED for POST /admin/login - error code: ${err.code}`);
                    }
                    return next(err);
                }
                if (err) {
                    if (req.path.startsWith('/admin/login') && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
                        console.log(`[CSRF DEBUG] Other error in CSRF middleware:`, err);
                    }
                    return next(err);
                }
                if (req.path.startsWith('/admin/login') && req.method === 'POST' && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
                    console.log(`[CSRF DEBUG] ✅ CSRF validation PASSED for POST /admin/login`);
                }
                try {
                    if (typeof req.csrfToken === 'function') {
                        const generatedToken = req.csrfToken();
                        res.locals.csrfToken = generatedToken;
                        if ((process.env.DEBUG === 'true' || process.env.DEBUG === '1') && req.path.startsWith('/admin/login')) {
                            if (req.method === 'GET') {
                                const sessionData = req.session;
                                console.log(`[CSRF DEBUG] Token generated for GET /admin/login:`, {
                                    token: generatedToken ? generatedToken.substring(0, 15) + '...' : 'empty',
                                    sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
                                    sessionKeys: sessionData ? Object.keys(sessionData).filter(k => k.includes('csrf') || k.includes('_csrf')).join(', ') : 'no session',
                                    csrfSecret: sessionData?._csrfSecret ? sessionData._csrfSecret.substring(0, 10) + '...' : 'not found'
                                });
                            }
                            else if (req.method === 'POST') {
                                const receivedToken = req.body?._csrf || req.headers['x-csrf-token'] || 'not provided';
                                const sessionData = req.session;
                                console.log(`[CSRF DEBUG] Token validated for POST /admin/login:`, {
                                    receivedToken: typeof receivedToken === 'string' ? receivedToken.substring(0, 15) + '...' : 'N/A',
                                    expectedToken: generatedToken ? generatedToken.substring(0, 15) + '...' : 'empty',
                                    tokensMatch: receivedToken === generatedToken,
                                    sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
                                    sessionKeys: sessionData ? Object.keys(sessionData).filter(k => k.includes('csrf') || k.includes('_csrf')).join(', ') : 'no session',
                                    csrfSecret: sessionData?._csrfSecret ? sessionData._csrfSecret.substring(0, 10) + '...' : 'not found'
                                });
                            }
                        }
                    }
                    else {
                        res.locals.csrfToken = '';
                        if ((process.env.DEBUG === 'true' || process.env.DEBUG === '1') && req.path.startsWith('/admin/login')) {
                            console.log(`[CSRF DEBUG] WARNING: No csrfToken function available on request`);
                        }
                    }
                }
                catch (tokenErr) {
                    res.locals.csrfToken = '';
                    console.error('Error generating CSRF token:', tokenErr);
                }
                next();
            });
        });
    }
    configureCsrfTokenInJsonResponse(app) {
        app.use((req, res, next) => {
            const originalJson = res.json.bind(res);
            res.json = function (body) {
                if (req.path.startsWith('/admin/api/') || req.xhr || req.get('accept')?.includes('application/json')) {
                    try {
                        const csrfToken = req.csrfToken ? req.csrfToken() :
                            (res.locals.csrfToken || '');
                        if (csrfToken && typeof body === 'object' && body !== null && !Array.isArray(body)) {
                            body.csrfToken = csrfToken;
                        }
                    }
                    catch (err) {
                        console.error('Error getting CSRF token for API response:', err);
                    }
                }
                return originalJson(body);
            };
            next();
        });
    }
    configureCsrfErrorHandler(app) {
        app.use((err, req, res, next) => {
            if (err.code !== 'EBADCSRFTOKEN') {
                return next(err);
            }
            const timestamp = new Date().toISOString();
            const receivedToken = req.body?._csrf || req.headers['x-csrf-token'] || 'not provided';
            const cookies = req.headers.cookie || 'none';
            let expectedToken = 'unknown';
            try {
                if (typeof req.csrfToken === 'function') {
                    expectedToken = req.csrfToken();
                }
            }
            catch (e) {
            }
            console.error(`[${timestamp}] CSRF token validation failed: ${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('user-agent'),
                referer: req.get('referer'),
                receivedToken: typeof receivedToken === 'string' ? receivedToken.substring(0, 15) + '...' : 'N/A',
                expectedToken: typeof expectedToken === 'string' ? expectedToken.substring(0, 15) + '...' : 'unknown',
                tokensMatch: receivedToken === expectedToken,
                hasSession: !!req.session,
                sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
                cookies: cookies.length > 100 ? cookies.substring(0, 100) + '...' : cookies,
                secure: req.secure,
                protocol: req.protocol,
                sessionData: req.session ? Object.keys(req.session).join(', ') : 'no session'
            });
            if (req.path.startsWith('/admin/api/') || req.xhr || req.get('content-type')?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid CSRF token. Please refresh the page and try again.',
                    code: 'CSRF_TOKEN_INVALID'
                });
            }
            const redirectPath = req.path.startsWith('/admin')
                ? '/admin/login?error=' + encodeURIComponent('Security token expired. Please try again.')
                : '/';
            res.redirect(redirectPath);
        });
    }
    configureSecurity(app) {
        app.set('trust proxy', 1);
        this.configureHelmet(app);
        this.configureSession(app);
        this.configureCookieSecureMiddleware(app);
        this.configureSessionDebugMiddleware(app);
        this.configureCsrfProtection(app);
        this.configureCsrfTokenInJsonResponse(app);
        this.configureCsrfErrorHandler(app);
    }
}
exports.SecurityService = SecurityService;
exports.securityService = SecurityService.getInstance();
exports.default = exports.securityService;
//# sourceMappingURL=securityService.js.map