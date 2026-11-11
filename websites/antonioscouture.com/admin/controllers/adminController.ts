import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { envConfig } from '../../src/config/env.config';
import { getTurnstileSiteKey, isTurnstileEnabled, verifyTurnstileToken } from '../../src/utils/turnstile';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

/** Fields shared by all admin login renders; includes Dev Login autofills in non-production. */
async function loginPageLocals(extra: Record<string, unknown>): Promise<Record<string, unknown>> {
  const isDevelopment = envConfig.nodeEnv !== 'production';
  const showDevQuickLogin = envConfig.devLikeRuntime;
  return {
    title: 'Admin Login',
    turnstileSiteKey: isDevelopment ? undefined : await getTurnstileSiteKey(),
    isDevelopment,
    showDevQuickLogin,
    layout: false,
    ...(showDevQuickLogin && {
      devLoginEmail: envConfig.devAdminEmail,
      devLoginPassword: envConfig.devAdminPassword,
    }),
    ...extra,
  };
}

export class AdminController {
  /**
   * Render admin login page
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get error from query parameter (e.g., from CSRF redirect)
      const error = req.query.error as string | undefined;
      
      // Get CSRF token from res.locals (set by CSRF middleware)
      const csrfToken = (res.locals as any).csrfToken || '';
      
      // Debug logging
      if (!csrfToken) {
        console.warn(`[LOGIN DEBUG] WARNING: CSRF token is empty when rendering login page`);
      } else {
        console.log(`[LOGIN DEBUG] CSRF token available for login page:`, {
          token: csrfToken.substring(0, 15) + '...',
          sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none'
        });
      }
      
      // Set headers to prevent Cloudflare from caching the login page
      // This is critical - cached login pages will have stale CSRF tokens
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      });
      
      res.render('auth/login', await loginPageLocals({
        siteTitle: siteTitle,
        error: error || undefined,
        csrfToken: csrfToken, // Explicitly pass CSRF token
      }));
    } catch (error) {
      console.error('Error rendering login page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle admin login form submission
   */
  public static async loginPost(req: Request, res: Response): Promise<void> {
    try {
      console.log(`[LOGIN POST] Starting login process`);
      
      // Set headers to prevent Cloudflare from caching login responses
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const { email, password, 'cf-turnstile-response': turnstileToken } = req.body;
      
      console.log(`[LOGIN POST] Email: ${email ? email.substring(0, 5) + '...' : 'missing'}, Password: ${password ? 'provided' : 'missing'}, Turnstile: ${turnstileToken ? `provided (length: ${turnstileToken.length})` : 'missing'}`);
      if (turnstileToken && turnstileToken.length < 10) {
        console.warn(`[LOGIN POST] ⚠️ WARNING: Turnstile token is suspiciously short (${turnstileToken.length} chars). Expected 100+ characters. Token value: ${turnstileToken}`);
      }
      
      // Validation
      if (!email || !password) {
        console.log(`[LOGIN POST] Validation failed: missing email or password`);
        // Get site settings
        const siteTitle = await siteSettingsService.getSiteTitle();
        
        return res.render('auth/login', await loginPageLocals({
          siteTitle,
          error: 'Email and password are required.',
        }));
      }

      // Verify Turnstile token if configured and in production
      // Skip Turnstile validation in development mode
      if (envConfig.nodeEnv === 'production' && (await isTurnstileEnabled())) {
        console.log(`[LOGIN POST] Production mode: Verifying Turnstile token...`);
        // Check if token is valid length (Turnstile tokens are typically 100+ characters)
        if (!turnstileToken || turnstileToken.length < 10) {
          console.warn(`[LOGIN POST] ⚠️ Turnstile token is missing or too short (${turnstileToken?.length || 0} chars). This usually means the Turnstile widget didn't load properly.`);
          console.warn(`[LOGIN POST] ⚠️ Possible causes: CSP blocking scripts, network issues, or Turnstile widget not initialized.`);
          console.warn(`[LOGIN POST] ⚠️ For now, skipping Turnstile validation to allow login. Please fix the Turnstile widget issue.`);
          // For now, allow login to proceed if Turnstile widget isn't working
          // TODO: Fix Turnstile widget loading issue
        } else {
          console.log(`[LOGIN POST] Verifying Turnstile token...`);
          const remoteip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
          const isTurnstileValid = await verifyTurnstileToken(turnstileToken, remoteip as string);
          
          console.log(`[LOGIN POST] Turnstile validation result: ${isTurnstileValid ? 'PASSED' : 'FAILED'}`);
          
          if (!isTurnstileValid) {
            console.log(`[LOGIN POST] Turnstile validation failed, returning error`);
            // Get site settings
            const siteTitle = await siteSettingsService.getSiteTitle();
            
            return res.render('auth/login', await loginPageLocals({
              siteTitle,
              error: 'Security verification failed. Please try again.',
            }));
          }
        }
      } else {
        // Development mode: Skip Turnstile verification
        if (envConfig.nodeEnv !== 'production') {
          console.log(`[LOGIN POST] Development mode: Skipping Turnstile verification`);
        }
      }
      
      // Authenticate user
      console.log(`[LOGIN POST] Authenticating user...`);
      const user = await usersService.authenticateUser(email, password);
      
      if (user) {
        console.log(`[LOGIN POST] ✅ Authentication SUCCESS for user: ${user.email}`);
        // Set session
        (req.session as any).user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };

        // Persist session before redirect so the cookie/store is written before the response is sent
        req.session.save((err) => {
          if (err) {
            console.error('[LOGIN POST] ❌ Session save failed:', err);
            siteSettingsService.getSiteTitle().then(async (siteTitle) => {
              res.render('auth/login', await loginPageLocals({
                siteTitle,
                error: 'Session error. Please try again.',
              }));
            });
            return;
          }
          console.log(`[LOGIN POST] Session saved, redirecting to dashboard. Session ID: ${req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none'}`);
          res.redirect('/admin/dashboard');
        });
      } else {
        console.log(`[LOGIN POST] ❌ Authentication FAILED: Invalid credentials`);
        // Get site settings
        const siteTitle = await siteSettingsService.getSiteTitle();
        
        res.render('auth/login', await loginPageLocals({
          siteTitle,
          error: 'Invalid email or password.',
        }));
      }
    } catch (error) {
      console.error('[LOGIN POST] ❌ ERROR during login:', error);
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      res.render('auth/login', await loginPageLocals({
        siteTitle,
        error: 'An error occurred during login.',
      }));
    }
  }

  /**
   * Handle admin logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/admin/login');
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.redirect('/admin/login');
    }
  }

  /**
   * Middleware to check if user is authenticated
   */
  public static requireAuth(req: Request, res: Response, next: Function): void {
    if (req.session && (req.session as any).user) {
      next();
    } else {
      res.redirect('/admin/login');
    }
  }

  /**
   * API middleware to check if user is authenticated - returns JSON response
   */
  public static requireApiAuth(req: Request, res: Response, next: Function): void {
    if (req.session && (req.session as any).user) {
      next();
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this API endpoint.'
      });
    }
  }
} 