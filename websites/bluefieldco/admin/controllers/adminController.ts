import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class AdminController {
  private static getLoginViewData(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const isDev = process.env.NODE_ENV !== 'production';

    return {
      title: 'Admin Login',
      siteTitle: siteSettingsService.getSiteTitle(),
      layout: false,
      isDev,
      ...(isDev && {
        devLoginEmail: process.env.DEV_ADMIN_EMAIL || 'admin@admin.com',
        devLoginPassword: process.env.DEV_ADMIN_PASSWORD || 'admin123',
      }),
      ...extra,
    };
  }

  /**
   * Render admin login page
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      res.render('auth/login', AdminController.getLoginViewData());
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
      
      // Validation
      if (!email || !password) {
        return res.render('auth/login', AdminController.getLoginViewData({
          error: 'Email and password are required.',
        }));
      }
      
      // Authenticate user
      const user = usersService.authenticateUser(email, password);
      
      if (user) {
        // Set session
        (req.session as any).adminLoggedIn = true;
        (req.session as any).user = {
          id: user.id,
          name: user.name,
          email: user.email
        };
        
        // Save session before redirect
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
          }
          res.redirect('/admin/dashboard');
        });
      } else {
        res.render('auth/login', AdminController.getLoginViewData({
          error: 'Invalid email or password.',
        }));
      }
    } catch (error) {
      console.error('Error during login:', error);

      res.render('auth/login', AdminController.getLoginViewData({
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
    if (req.session && (req.session as any).adminLoggedIn) {
      next();
    } else {
      res.redirect('/admin/login');
    }
  }

  /**
   * API middleware to check if user is authenticated - returns JSON response
   */
  public static requireApiAuth(req: Request, res: Response, next: Function): void {
    if (req.session && (req.session as any).adminLoggedIn) {
      next();
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this API endpoint.'
      });
    }
  }
} 