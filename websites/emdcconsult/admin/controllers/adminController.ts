import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class AdminController {
  /**
   * Render admin login page
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('auth/login', {
        title: 'Admin Login',
        siteTitle: siteTitle,
        layout: false
      });
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
        // Get site settings
        const siteTitle = siteSettingsService.getSiteTitle();
        
        return res.render('auth/login', {
          title: 'Admin Login',
          siteTitle: siteTitle,
          error: 'Email and password are required.',
          layout: false
        });
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
        // Get site settings
        const siteTitle = siteSettingsService.getSiteTitle();
        
        res.render('auth/login', {
          title: 'Admin Login',
          siteTitle: siteTitle,
          error: 'Invalid email or password.',
          layout: false
        });
      }
    } catch (error) {
      console.error('Error during login:', error);
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('auth/login', {
        title: 'Admin Login',
        siteTitle: siteTitle,
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