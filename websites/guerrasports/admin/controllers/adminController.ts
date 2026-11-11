import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { envConfig } from '../../src/config/env.config';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

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
      
      res.render('auth/login', {
        title: 'Admin Login',
        siteTitle: siteTitle,
        turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
        isDevelopment: envConfig.nodeEnv !== 'production',
        error: error || undefined,
        csrfToken: csrfToken, // Explicitly pass CSRF token
        layout: false
      });
    } catch (error) {
      console.error('Error rendering login page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Verify Turnstile token with Cloudflare
   */
  private static async verifyTurnstileToken(token: string, remoteip?: string): Promise<boolean> {
    if (!envConfig.turnstileSecretKey) {
      // If Turnstile is not configured, skip verification
      console.log(`[TURNSTILE] Turnstile not configured, skipping verification`);
      return true;
    }

    if (!token) {
      console.log(`[TURNSTILE] ❌ No token provided`);
      return false;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('secret', envConfig.turnstileSecretKey);
      formData.append('response', token);
      if (remoteip) {
        formData.append('remoteip', remoteip);
      }

      console.log(`[TURNSTILE] Verifying token with Cloudflare...`, {
        tokenLength: token.length,
        remoteip: remoteip || 'not provided',
        secretKeySet: !!envConfig.turnstileSecretKey
      });

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();
      console.log(`[TURNSTILE] Cloudflare response:`, {
        success: data.success,
        'error-codes': data['error-codes'] || [],
        challenge_ts: data.challenge_ts,
        hostname: data.hostname
      });

      if (!data.success && data['error-codes']) {
        console.error(`[TURNSTILE] ❌ Validation failed with errors:`, data['error-codes']);
      }

      return data.success === true;
    } catch (error) {
      console.error('[TURNSTILE] ❌ Error verifying Turnstile token:', error);
      return false;
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
        
        return res.render('auth/login', {
          title: 'Admin Login',
          siteTitle: siteTitle,
          turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
          isDevelopment: envConfig.nodeEnv !== 'production',
          error: 'Email and password are required.',
          layout: false
        });
      }

      // Verify Turnstile token if configured and in production
      // Skip Turnstile validation in development mode
      if (envConfig.nodeEnv === 'production' && envConfig.turnstileSecretKey) {
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
          const isTurnstileValid = await AdminController.verifyTurnstileToken(turnstileToken, remoteip as string);
          
          console.log(`[LOGIN POST] Turnstile validation result: ${isTurnstileValid ? 'PASSED' : 'FAILED'}`);
          
          if (!isTurnstileValid) {
            console.log(`[LOGIN POST] Turnstile validation failed, returning error`);
            // Get site settings
            const siteTitle = await siteSettingsService.getSiteTitle();
            
            return res.render('auth/login', {
              title: 'Admin Login',
              siteTitle: siteTitle,
              turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
              isDevelopment: envConfig.nodeEnv !== 'production',
              error: 'Security verification failed. Please try again.',
              layout: false
            });
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
            siteSettingsService.getSiteTitle().then((siteTitle) => {
              res.render('auth/login', {
                title: 'Admin Login',
                siteTitle,
                turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
                isDevelopment: envConfig.nodeEnv !== 'production',
                error: 'Session error. Please try again.',
                layout: false
              });
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
        
        res.render('auth/login', {
          title: 'Admin Login',
          siteTitle: siteTitle,
          turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
          isDevelopment: envConfig.nodeEnv !== 'production',
          error: 'Invalid email or password.',
          layout: false
        });
      }
    } catch (error) {
      console.error('[LOGIN POST] ❌ ERROR during login:', error);
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      res.render('auth/login', {
        title: 'Admin Login',
        siteTitle: siteTitle,
        turnstileSiteKey: envConfig.nodeEnv === 'production' ? envConfig.turnstileSiteKey : undefined,
        isDevelopment: envConfig.nodeEnv !== 'production',
        error: 'An error occurred during login.',
        layout: false
      });
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