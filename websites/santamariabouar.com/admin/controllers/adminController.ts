import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { canLoginToAdmin } from '../utils/roleMiddleware';
import { regenerateSession } from '../../src/utils/sessionHelpers';
import { getRecaptchaSiteKey } from '../../src/services/recaptchaService';

const siteSettingsService = SiteSettingsService.getInstance();

function isDevLoginAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    String(process.env.ALLOW_DEV_LOGIN || '').trim().toLowerCase() === 'true' &&
    Boolean(String(process.env.DEV_LOGIN_EMAIL || '').trim()) &&
    Boolean(String(process.env.DEV_LOGIN_PASSWORD || '').trim())
  );
}

async function renderLogin(res: Response, error?: string): Promise<void> {
  const siteTitle = await siteSettingsService.getSiteTitle();
  res.render('auth/login', {
    title: 'Admin Login',
    siteTitle: siteTitle,
    isDev: isDevLoginAllowed(),
    recaptchaSiteKey: getRecaptchaSiteKey(),
    error,
    layout: false
  });
}

async function establishAdminSession(req: Request, user: {
  id: number;
  name: string;
  email?: string;
  role: string;
}): Promise<void> {
  await regenerateSession(req);
  (req.session as any).user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  await usersService.recordLastLogin(user.id);
}

export class AdminController {
  /**
   * Render admin login page
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const error =
        typeof req.query.error === 'string' && req.query.error.trim()
          ? req.query.error.trim()
          : undefined;
      await renderLogin(res, error);
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
      const { email, password } = req.body;

      if (!email || !password) {
        return renderLogin(res, 'Email and password are required.');
      }

      const user = await usersService.authenticateUser(email, password);

      if (!user) {
        return renderLogin(res, 'Invalid email or password.');
      }

      if (!canLoginToAdmin(user.role)) {
        return renderLogin(res, 'Access denied. Only Super Admin and Admin users can log in to the admin portal.');
      }

      await establishAdminSession(req, user);
      res.redirect('/admin/dashboard');
    } catch (error) {
      console.error('Error during login:', error);
      await renderLogin(res, 'An error occurred during login.');
    }
  }

  /**
   * One-click dev login (development only, env-gated)
   */
  public static async devLoginPost(req: Request, res: Response): Promise<void> {
    if (!isDevLoginAllowed()) {
      res.status(404).send('Not found');
      return;
    }

    try {
      const email = String(process.env.DEV_LOGIN_EMAIL || '').trim();
      const password = String(process.env.DEV_LOGIN_PASSWORD || '');
      const user = await usersService.authenticateUser(email, password);

      if (!user) {
        return renderLogin(res, 'Dev login failed — user not found or invalid credentials.');
      }

      if (!canLoginToAdmin(user.role)) {
        return renderLogin(res, 'Access denied. Only Super Admin and Admin users can log in to the admin portal.');
      }

      await establishAdminSession(req, user);
      res.redirect('/admin/dashboard');
    } catch (error) {
      console.error('Error during dev login:', error);
      await renderLogin(res, 'An error occurred during dev login.');
    }
  }

  /**
   * Handle admin logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
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
