/**
 * Security Service
 * 
 * Handles security middleware configuration including:
 * - Helmet security headers
 * - Session configuration
 * - CSRF protection
 */

import { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
const csrf = require('csurf');
import { envConfig } from '../config/env.config';
import { getCspConfig } from './cspService';
import db from '../config/database';

export class SecurityService {
  private static instance: SecurityService;
  public csrfProtection: any;
  /** Same middleware instance as used on Express — needed for Socket.IO handshake session. */
  private sessionMiddleware: RequestHandler | null = null;

  private constructor() {
    this.csrfProtection = csrf();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Configure and apply helmet security headers
   */
  public configureHelmet(app: Express): void {
    const isProduction = envConfig.nodeEnv === 'production';

    app.use(helmet({
      // ClickJacking Protection: Prevent site from being embedded in iframes
      frameguard: {
        action: 'deny'
      },
      // Content Type Sniffing Prevention: Prevent MIME type sniffing
      noSniff: true,
      // Strict Transport Security: Force HTTPS connections
      hsts: isProduction ? {
        maxAge: process.env.HSTS_MAX_AGE ? parseInt(process.env.HSTS_MAX_AGE, 10) : 31536000, // 1 year in seconds
        includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true' || process.env.HSTS_INCLUDE_SUBDOMAINS === undefined,
        preload: process.env.HSTS_PRELOAD === 'true'
      } : false, // Disable HSTS in development
      // Content Security Policy: Control which resources can be loaded
      contentSecurityPolicy: getCspConfig(isProduction)
    }));
  }

  /**
   * Configure and apply session middleware
   */
  public configureSession(app: Express): void {
    const isProduction = envConfig.nodeEnv === 'production';

    // Session configuration
    // In production, we always use HTTPS (either directly or via proxy)
    // The secure flag must be true in production for security
    // Trust proxy is set, so Express will detect HTTPS from X-Forwarded-Proto header
    const sessionConfig: any = {
      secret: envConfig.sessionSecret,
      resave: false,
      saveUninitialized: true, // Changed to true to allow CSRF token generation for login page
      name: 'connect.sid', // Explicit session cookie name
      cookie: { 
        // In production, always use secure cookies (HTTPS required)
        // Trust proxy will make req.secure work correctly with X-Forwarded-Proto header
        secure: isProduction, // true in production, false in development
        httpOnly: true,
        sameSite: 'lax' as const,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }
    };

    // Only set domain if explicitly configured (don't set it otherwise to use default behavior)
    // Note: Setting domain can cause issues if not done correctly
    // For a single domain, it's often better to NOT set the domain at all
    // IMPORTANT: With Cloudflare, don't set domain unless you really need subdomain sharing
    if (envConfig.cookieDomain && envConfig.cookieDomain.trim() !== '') {
      sessionConfig.cookie.domain = envConfig.cookieDomain;
      console.log(`[SESSION CONFIG] Cookie domain set to: ${envConfig.cookieDomain}`);
    } else {
      console.log(`[SESSION CONFIG] Cookie domain not set (using default - current host only)`);
    }

    // Use MySQL-backed session store to prevent RAM growth from MemoryStore
    const MySQLStore = MySQLStoreFactory(session);
    const sessionStore = new MySQLStore({
      expiration: 24 * 60 * 60 * 1000,   // match cookie maxAge (24 hours)
      createDatabaseTable: true,           // auto-create `sessions` table if missing
      clearExpired: true,                  // auto-delete expired rows
      checkExpirationInterval: 30 * 60 * 1000, // run cleanup every 30 minutes
    }, db.getPool() as any);
    sessionConfig.store = sessionStore;

    // Log session configuration on startup
    console.log(`[SESSION CONFIG] Session cookie secure flag: ${sessionConfig.cookie.secure} (${isProduction ? 'PRODUCTION - HTTPS required' : 'DEVELOPMENT - HTTP allowed'})`);
    console.log(`[SESSION CONFIG] Trust proxy: ${app.get('trust proxy')} (HTTPS detection via X-Forwarded-Proto header)`);
    console.log('[SESSION CONFIG] Using MySQL session store (sessions table)');

    this.sessionMiddleware = session(sessionConfig) as RequestHandler;
    app.use(this.sessionMiddleware);
  }

  /** Session middleware (call `configureSession` first). Used by Socket.IO to attach sessions to handshake requests. */
  public getSessionMiddleware(): RequestHandler {
    if (!this.sessionMiddleware) {
      throw new Error('getSessionMiddleware: configureSession must run first');
    }
    return this.sessionMiddleware;
  }

  /**
   * Middleware to ensure cookie secure flag matches actual connection protocol
   */
  public configureCookieSecureMiddleware(app: Express): void {
    const isProduction = envConfig.nodeEnv === 'production';

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.session && req.session.cookie) {
        // Detect actual protocol (works with trust proxy; nginx must send X-Forwarded-Proto)
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
          // Force cookie to be reset with new secure flag
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

  /**
   * Configure debug middleware for session (production only, and only when DEBUG=true)
   */
  public configureSessionDebugMiddleware(app: Express): void {
    const isProduction = envConfig.nodeEnv === 'production';
    const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

    if (isProduction && debugOn) {
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/admin/login')) {
          const sessionCookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('connect.sid='));
          const forwardedProto = req.get('x-forwarded-proto');
          const forwardedFor = req.get('x-forwarded-for');
          
          // Extract session ID from cookie if present
          let cookieSessionId = 'none';
          if (sessionCookie) {
            try {
              // Cookie format: connect.sid=s%3A<sessionId>.<signature>
              const cookieValue = decodeURIComponent(sessionCookie.split('=')[1]);
              // Remove the 's:' prefix if present
              const sessionIdMatch = cookieValue.match(/^s:(.+?)\./);
              if (sessionIdMatch) {
                cookieSessionId = sessionIdMatch[1].substring(0, 15) + '...';
              } else {
                cookieSessionId = cookieValue.substring(0, 15) + '...';
              }
            } catch (e) {
              cookieSessionId = 'parse error';
            }
          }
          
          if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log(`[SESSION DEBUG] ${req.method} ${req.path}`, {
            hasSession: !!req.session,
            sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
            cookieSessionId: cookieSessionId,
            sessionIdsMatch: req.sessionID && cookieSessionId !== 'none' ? 
              req.sessionID.substring(0, 15) === cookieSessionId.substring(0, 15) : false,
            cookieInRequest: sessionCookie ? sessionCookie.substring(0, 50) + '...' : 'none',
            protocol: req.protocol,
            secure: req.secure,
            host: req.get('host'),
            cookieDomain: envConfig.cookieDomain || 'not set',
            xForwardedProto: forwardedProto || 'not set',
            xForwardedFor: forwardedFor || 'not set',
            trustProxy: app.get('trust proxy'),
            cookieSecure: req.session?.cookie?.secure,
            cookieHttpOnly: req.session?.cookie?.httpOnly
          });
          
          // Log when response is sent to see if Set-Cookie header is being set
          const originalEnd = res.end;
          res.end = function(chunk?: any, encoding?: any) {
            const setCookieHeader = res.getHeader('Set-Cookie');
            if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
              if (setCookieHeader) {
                console.log(`[SESSION DEBUG] Set-Cookie header sent:`, {
                  setCookie: Array.isArray(setCookieHeader) ? setCookieHeader[0]?.substring(0, 50) + '...' : String(setCookieHeader).substring(0, 50) + '...'
                });
              } else {
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

  /**
   * Helper to extract CSRF token from request (supports both body and headers)
   */
  public getCsrfTokenFromRequest(req: Request): string | null {
    // Try body first (for urlencoded/json)
    if (req.body && req.body._csrf) {
      return req.body._csrf;
    }
    
    // Try headers (for multipart forms and AJAX)
    const headerToken = req.headers['x-csrf-token'] || req.headers['csrf-token'] || req.headers['xsrf-token'];
    if (headerToken && typeof headerToken === 'string') {
      return headerToken;
    }
    
    return null;
  }

  /**
   * Configure CSRF protection middleware
   */
  public configureCsrfProtection(app: Express): void {
    // Apply CSRF protection to all requests
    // csurf automatically generates tokens for GET/HEAD and validates for POST/PUT/DELETE
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip OPTIONS requests (CORS preflight)
      if (req.method === 'OPTIONS') {
        return next();
      }

      // Socket.IO Engine.IO polling/WebSocket upgrade — no CSRF token on handshake
      if (req.path.startsWith('/socket.io')) {
        return next();
      }
      
      // For multipart forms, csurf can't read from body until multer processes it
      // So we skip CSRF validation here and validate manually after multer in controllers
      const isMultipart = req.get('content-type')?.includes('multipart/form-data');
      if (isMultipart && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        // Skip CSRF validation for multipart - will be validated after multer processes form
        // But still generate token for views
        try {
          if (typeof (req as any).csrfToken === 'function') {
            (res.locals as any).csrfToken = (req as any).csrfToken();
          } else {
            (res.locals as any).csrfToken = '';
          }
        } catch (tokenErr) {
          (res.locals as any).csrfToken = '';
        }
        // Mark request to skip CSRF validation (will be validated manually after multer)
        (req as any)._skipCsrfValidation = true;
        return next();
      }
      
      this.csrfProtection(req, res, (err: any) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
          // CSRF token validation failed - handle in error handler
          if (req.path.startsWith('/admin/login') && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
            console.log(`[CSRF DEBUG] Validation FAILED for POST /admin/login - error code: ${err.code}`);
          }
          return next(err);
        }
        if (err) {
          // Other errors
          if (req.path.startsWith('/admin/login') && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
            console.log(`[CSRF DEBUG] Other error in CSRF middleware:`, err);
          }
          return next(err);
        }
        
        // If we get here, validation PASSED
        if (req.path.startsWith('/admin/login') && req.method === 'POST' && (process.env.DEBUG === 'true' || process.env.DEBUG === '1')) {
          console.log(`[CSRF DEBUG] ✅ CSRF validation PASSED for POST /admin/login`);
        }
        // Token generated/validated successfully, make it available to views
        try {
          // Always get fresh token - csurf stores it in req.csrfToken function
          if (typeof (req as any).csrfToken === 'function') {
            const generatedToken = (req as any).csrfToken();
            (res.locals as any).csrfToken = generatedToken;
            
            // Debug logging for login page (only when DEBUG=true)
            if ((process.env.DEBUG === 'true' || process.env.DEBUG === '1') && req.path.startsWith('/admin/login')) {
              if (req.method === 'GET') {
                const sessionData = (req.session as any);
                console.log(`[CSRF DEBUG] Token generated for GET /admin/login:`, {
                  token: generatedToken ? generatedToken.substring(0, 15) + '...' : 'empty',
                  sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none',
                  sessionKeys: sessionData ? Object.keys(sessionData).filter(k => k.includes('csrf') || k.includes('_csrf')).join(', ') : 'no session',
                  csrfSecret: sessionData?._csrfSecret ? sessionData._csrfSecret.substring(0, 10) + '...' : 'not found'
                });
              } else if (req.method === 'POST') {
                const receivedToken = req.body?._csrf || req.headers['x-csrf-token'] || 'not provided';
                const sessionData = (req.session as any);
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
          } else {
            (res.locals as any).csrfToken = '';
            if ((process.env.DEBUG === 'true' || process.env.DEBUG === '1') && req.path.startsWith('/admin/login')) {
              console.log(`[CSRF DEBUG] WARNING: No csrfToken function available on request`);
            }
          }
        } catch (tokenErr) {
          // If token generation fails, set empty string
          (res.locals as any).csrfToken = '';
          console.error('Error generating CSRF token:', tokenErr);
        }
        next();
      });
    });
  }

  /**
   * Middleware to add CSRF token to JSON responses for API endpoints
   */
  public configureCsrfTokenInJsonResponse(app: Express): void {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to include CSRF token for API endpoints
      res.json = function(body: any) {
        // Only add CSRF token to API endpoints that return JSON
        if (req.path.startsWith('/admin/api/') || req.xhr || req.get('accept')?.includes('application/json')) {
          try {
            // Get current CSRF token from request (same token, not regenerated)
            const csrfToken = (req as any).csrfToken ? (req as any).csrfToken() : 
                             ((res.locals as any).csrfToken || '');
            if (csrfToken && typeof body === 'object' && body !== null && !Array.isArray(body)) {
              // Add CSRF token to response if it's an object (not array)
              body.csrfToken = csrfToken;
            }
          } catch (err) {
            // If token generation fails, continue without it
            console.error('Error getting CSRF token for API response:', err);
          }
        }
        return originalJson(body);
      };
      
      next();
    });
  }

  /**
   * Configure CSRF error handler
   */
  public configureCsrfErrorHandler(app: Express): void {
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err.code !== 'EBADCSRFTOKEN') {
        return next(err);
      }
      
      // CSRF token validation failed
      const timestamp = new Date().toISOString();
      const receivedToken = req.body?._csrf || req.headers['x-csrf-token'] || 'not provided';
      const cookies = req.headers.cookie || 'none';
      
      // Try to get the expected token from session for comparison
      let expectedToken = 'unknown';
      try {
        if (typeof (req as any).csrfToken === 'function') {
          expectedToken = (req as any).csrfToken();
        }
      } catch (e) {
        // Ignore
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
      
      // If it's an API request, return JSON error
      if (req.path.startsWith('/admin/api/') || req.xhr || req.get('content-type')?.includes('application/json')) {
        return res.status(403).json({ 
          success: false,
          error: 'Invalid CSRF token. Please refresh the page and try again.',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
      
      // For regular form submissions, redirect with error message
      const redirectPath = req.path.startsWith('/admin') 
        ? '/admin/login?error=' + encodeURIComponent('Security token expired. Please try again.')
        : '/';
      res.redirect(redirectPath);
    });
  }

  /**
   * Apply all security configurations to the app
   */
  public configureSecurity(app: Express): void {
    // Trust proxy (required when behind nginx reverse proxy)
    // This allows Express to correctly identify secure connections and set secure cookies
    app.set('trust proxy', 1);

    // Configure helmet security headers
    this.configureHelmet(app);

    // Configure session
    this.configureSession(app);

    // Configure cookie secure middleware
    this.configureCookieSecureMiddleware(app);

    // Configure session debug middleware (production only)
    this.configureSessionDebugMiddleware(app);

    // Configure CSRF protection
    this.configureCsrfProtection(app);

    // Configure CSRF token in JSON responses
    this.configureCsrfTokenInJsonResponse(app);

    // Configure CSRF error handler
    this.configureCsrfErrorHandler(app);
  }
}

export const securityService = SecurityService.getInstance();
export default securityService;
