import { Request, Response } from 'express';
import { usersService } from '../../admin/services/usersService';
import orderService from '../services/orderService';
import cartService from '../services/cartService';
import { db } from '../config/database';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { OrderShipmentService } from '../../admin/services/orderShipmentService';
import { i18nService } from '../../admin/services/i18nService';
import emailService from '../services/emailService';
import * as crypto from 'crypto';
import encryptionService from '../services/encryptionService';
import { envConfig } from '../config/env.config';
import { verifyTurnstileToken } from '../utils/turnstile';
import { getDataFilePath } from '../constants/data-paths';
import * as fs from 'fs';
import { trackShipmentsJson } from '../aramex';
import shippingService from '../services/shippingService';

const shipmentService = OrderShipmentService.getInstance();

const siteSettingsService = SiteSettingsService.getInstance();

// Turnstile always shown on login/register in dev (Cloudflare test key when env not set)
const authTurnstileSiteKey = envConfig.turnstileSiteKey ?? (envConfig.nodeEnv !== 'production' ? '1x00000000000000000000AA' : undefined);

export class CustomerController {
  /**
   * Customer account page
   */
  public static async account(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.redirect('/customer/login');
        return;
      }

      const user = await usersService.getUserById(customerId);
      if (!user) {
        res.redirect('/customer/login');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      const [addresses] = await db.query<any>(
        'SELECT * FROM customer_addresses WHERE customer_id = ? AND is_default = 1 LIMIT 1',
        [customerId]
      );
      
      let defaultAddress = null;
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        if (addr.content_encrypted && addr.iv) {
          try {
            const decryptedData = encryptionService.decrypt(addr.content_encrypted, addr.iv);
            if (decryptedData) {
              defaultAddress = { ...addr, ...decryptedData };
            }
          } catch (e) {
            console.error('Failed to decrypt default address:', e);
          }
        }
      }

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.account') : 'My Account';
      res.render('customer/account', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.account') : 'My Account',
        siteTitle,
        t,
        user,
        activePage: 'account',
        recentOrders: await orderService.getCustomerOrders(customerId, 2),
        defaultAddress
      });
    } catch (error) {
      console.error('Error rendering account page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer orders page
   */
  public static async ordersPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.redirect('/customer/login');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      const orders = await orderService.getCustomerOrders(customerId);

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.orders') : 'My Orders';
      res.render('customer/orders', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.orders') : 'My Orders',
        siteTitle,
        t,
        activePage: 'orders',
        orders
      });
    } catch (error) {
      console.error('Error rendering orders page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer order detail page
   */
  public static async orderDetailPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.redirect('/customer/login');
        return;
      }

      const { orderNumber } = req.params;
      const order = await orderService.getOrderByNumber(orderNumber);

      if (!order || order.customer_id !== customerId) {
        res.status(404).render('404');
        return;
      }

      const orderWithItems = await orderService.getOrderWithItems(order.id);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const shippingMethodLabel = await shippingService.getShippingMethodDisplayName(orderWithItems?.shipping_method ?? order.shipping_method);

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? `${t('ecommerce.customer.order')} #${order.order_number}` : `Order #${order.order_number}`;
      const firstPid = orderWithItems?.items?.[0]?.product_id;
      if (firstPid) {
        const imgQuery = await db.query(
          `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, order_index ASC, id ASC LIMIT 1`,
          [firstPid]
        );
        const imgRows = imgQuery[0] as { image_url?: string }[];
        const ou = imgRows[0]?.image_url;
        if (ou && String(ou).trim()) (res.locals as any).pageImage = String(ou).trim();
      }

      res.render('customer/order-detail', {
        title: typeof t !== 'undefined' ? `${t('ecommerce.customer.order')} #${order.order_number}` : `Order #${order.order_number}`,
        siteTitle,
        t,
        activePage: 'orders',
        order: orderWithItems,
        shippingMethodLabel
      });
    } catch (error) {
      console.error('Error rendering order detail page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer addresses page
   */
  public static async addressesPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.redirect('/customer/login');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      const [rows] = await db.query<any>(
        'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
        [customerId]
      );

      // Decrypt addresses for view
      const addresses = rows.map(row => {
        if (row.content_encrypted && row.iv) {
          try {
            const decryptedData = encryptionService.decrypt(row.content_encrypted, row.iv);
            if (decryptedData) {
              return { ...row, ...decryptedData };
            }
          } catch (e) {
            console.error('Failed to decrypt address in view controller:', e);
          }
        }
        return row;
      });

      // Load countries from config file (path from project root for dev and production)
      let countries: any[] = [];
      try {
        const countriesPath = getDataFilePath('countries.json');
        const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf-8'));
        countries = countriesData.countries || [];
      } catch (error) {
        console.error('Error loading countries:', error);
        // Fallback to a basic list
        countries = [
          { name: 'Lebanon', code: 'LB' },
          { name: 'United States', code: 'US' },
          { name: 'United Kingdom', code: 'GB' },
          { name: 'Canada', code: 'CA' },
          { name: 'UAE', code: 'AE' }
        ];
      }

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.addresses') : 'My Addresses';
      res.render('customer/addresses', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.addresses') : 'My Addresses',
        siteTitle,
        t,
        activePage: 'addresses',
        addresses,
        returnTo: req.query.returnTo,
        countries
      });
    } catch (error) {
      console.error('Error rendering addresses page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer wishlist page
   */
  public static async wishlistPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const sessionId = req.sessionID;
      // if (!customerId) {
      //   res.redirect('/customer/login');
      //   return;
      // } // Allow guests

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      let query = `SELECT w.*, p.name as product_name, p.slug as product_slug, p.price,
         (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url,
         EXists(SELECT 1 FROM product_variants WHERE product_id = p.id AND is_active = TRUE) as has_variants
         FROM wishlists w
         LEFT JOIN products p ON w.product_id = p.id
         WHERE `;
      let params = [];
      
      if (customerId) {
        query += 'w.customer_id = ?';
        params.push(customerId);
      } else {
        query += 'w.session_id = ? AND w.customer_id IS NULL';
        params.push(sessionId);
      }
      
      query += ' ORDER BY w.created_at DESC';

      const [wishlist] = await db.query<any[]>(query, params);

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.wishlist') : 'My Wishlist';
      const wlOg = (wishlist as any[])?.find((row: any) => row.image_url && String(row.image_url).trim())?.image_url;
      if (wlOg) (res.locals as any).pageImage = String(wlOg).trim();

      res.render('customer/wishlist', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.wishlist') : 'My Wishlist',
        siteTitle,
        t,
        activePage: 'wishlist',
        wishlist: wishlist || []
      });
    } catch (error) {
      console.error('Error rendering wishlist page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer login page
   */
  public static async loginPage(req: Request, res: Response): Promise<void> {
    try {
      // If already logged in, redirect to account
      const customerId = (req.session as any).user?.id;
      if (customerId) {
        res.redirect('/customer/account');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      const returnTo = req.query.returnTo;
      const error = typeof req.query.error === 'string' ? req.query.error : undefined;

    (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Customer Login';
    res.render('customer/login', {
      title: typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Customer Login',
      siteTitle,
      t,
      returnTo,
      error,
      turnstileSiteKey: authTurnstileSiteKey,
      isDevelopment: envConfig.nodeEnv !== 'production'
    });
    } catch (error) {
      console.error('Error rendering login page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Customer register page
   */
  public static async registerPage(req: Request, res: Response): Promise<void> {
    try {
      // If already logged in, redirect to account
      const customerId = (req.session as any).user?.id;
      if (customerId) {
        res.redirect('/customer/account');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const returnTo = req.query.returnTo;
      const orderNumber = req.query.orderNumber;

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.register') : 'Customer Registration';
      res.render('customer/register', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.register') : 'Customer Registration',
        siteTitle,
        t,
        returnTo,
        orderNumber: typeof orderNumber === 'string' ? orderNumber : undefined,
        turnstileSiteKey: authTurnstileSiteKey,
        isDevelopment: envConfig.nodeEnv !== 'production'
      });
    } catch (error) {
      console.error('Error rendering register page:', error);
      res.status(500).render('error', { error });
    }
  }
  /**
   * Customer registration
   */
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, confirmPassword, name, phone, cf_turnstile_response, orderNumber: orderNumberFromBody } = req.body;

      if (envConfig.turnstileSecretKey && !cf_turnstile_response) {
        res.status(400).json({ error: 'Please complete the security verification' });
        return;
      }
      if (envConfig.turnstileSecretKey && cf_turnstile_response) {
        const valid = await verifyTurnstileToken(cf_turnstile_response, req.ip || (req.socket as any)?.remoteAddress);
        if (!valid) {
          res.status(400).json({ error: 'Security verification failed. Please try again.' });
          return;
        }
      }

      // Validate required fields
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
      if (!trimmedName) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (!trimmedPhone) {
        res.status(400).json({ error: 'Phone is required' });
        return;
      }

      // Validate password confirmation
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match' });
        return;
      }

      // Check if user exists
      const existingUser = await usersService.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Create user: username = email (unique); display name stored via updateUser
      const [result] = await db.query<any>(
        `INSERT INTO users (username, email, status, role, created_at)
        VALUES (?, ?, 'Active', 'customer', NOW())`,
        [email, email]
      );
      
      const insertId = (result as any).insertId;

      // Set password if provided
      if (password) {
        await usersService.updateUser(insertId, { password } as any);
      }

      // Save phone only (username stays email for uniqueness; app shows username as display name)
      await usersService.updateUser(insertId, { phone: trimmedPhone } as any);

      // Get created user
      const user = await usersService.getUserById(insertId);

      if (user) {
        // Set session
        (req.session as any).user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };

        // Merge session cart with customer cart so cart is not lost
        const sessionId = req.sessionID;
        const sessionCart = await cartService.getOrCreateSessionCart(sessionId);
        if (sessionCart.items && sessionCart.items.length > 0) {
          await cartService.mergeCarts(sessionCart.id, user.id);
        }

        // Attach any guest orders placed with this email so they appear under "My Orders"
        await orderService.attachGuestOrdersToCustomer(user.id, (user.email ?? email).trim());

        // If they came from order-success with an order number, attach that specific guest order (in case email didn't match)
        const orderNumberToAttach = typeof orderNumberFromBody === 'string' ? orderNumberFromBody.trim() : undefined;
        if (orderNumberToAttach) {
          const orderFromLink = await orderService.getOrderByNumber(orderNumberToAttach);
          if (orderFromLink && orderFromLink.customer_id == null) {
            await orderService.attachOrderToCustomer(orderFromLink.id, user.id);
          }
        }

        // Merge session wishlist with customer wishlist
        const [sessionWishlist] = await db.query<any[]>(
          'SELECT product_id, variant_id FROM wishlists WHERE session_id = ? AND customer_id IS NULL',
          [sessionId]
        );
        if (sessionWishlist.length > 0) {
          for (const item of sessionWishlist as any[]) {
            await db.query(
              'INSERT IGNORE INTO wishlists (customer_id, product_id, variant_id) VALUES (?, ?, ?)',
              [user.id, item.product_id, item.variant_id]
            );
          }
          await db.query('DELETE FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
        }

        res.json({ success: true, user });
      } else {
        res.status(500).json({ error: 'Failed to create user' });
      }
    } catch (error) {
      console.error('Error registering customer:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  /**
   * Forgot password page
   */
  public static async forgotPasswordPage(req: Request, res: Response): Promise<void> {
    try {
      // If already logged in, redirect to account
      const customerId = (req.session as any).user?.id;
      if (customerId) {
        res.redirect('/customer/account');
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.forgotPassword') : 'Forgot Password';
      res.render('customer/forgot-password', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.forgotPassword') : 'Forgot Password',
        siteTitle,
        t
      });
    } catch (error) {
      console.error('Error rendering forgot password page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Process forgot password request
   */
  public static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = await usersService.getUserByEmail(email);
      
      // Always return success even if user not found (security)
      if (!user) {
        // Log attempt for security monitoring (optional)
        if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') console.log(`Password reset requested for non-existent email: ${email}`);
        res.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions.' });
        return;
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour

      // Save token to user
      await db.query(
        'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
        [token, expires, user.id]
      );

      // Create reset URL
      const resetUrl = `${req.protocol}://${req.get('host')}/customer/reset-password/${token}`;

      // Send email
      await emailService.sendPasswordReset(email, token, resetUrl);

      res.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions.' });
    } catch (error) {
      console.error('Error processing forgot password:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  /**
   * Reset password page
   */
  public static async resetPasswordPage(req: Request, res: Response): Promise<void> {
    try {
      // If already logged in, redirect to account
      const customerId = (req.session as any).user?.id;
      if (customerId) {
        res.redirect('/customer/account');
        return;
      }

      const { token } = req.params;

      // Validate token
      const [users] = await db.query<any[]>(
        'SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
        [token]
      );

      if (users.length === 0) {
        const siteTitle = await siteSettingsService.getSiteTitle();
        const t = await i18nService.getTranslations(req);
        
        (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Login';
        res.render('customer/login', {
          title: typeof t !== 'undefined' ? t('ecommerce.customer.login') : 'Login',
          siteTitle,
          t,
          turnstileSiteKey: authTurnstileSiteKey,
          isDevelopment: envConfig.nodeEnv !== 'production',
          error: 'Password reset link is invalid or has expired.'
        });
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      (res.locals as any).pageTitle = typeof t !== 'undefined' ? t('ecommerce.customer.resetPassword') : 'Reset Password';
      res.render('customer/reset-password', {
        title: typeof t !== 'undefined' ? t('ecommerce.customer.resetPassword') : 'Reset Password',
        siteTitle,
        t,
        token
      });
    } catch (error) {
      console.error('Error rendering reset password page:', error);
      res.status(500).render('error', { error });
    }
  }

  /**
   * Process reset password
   */
  public static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password, confirmPassword } = req.body;

      if (!password || !confirmPassword) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match' });
        return;
      }

      // Validate token
      const [rows] = await db.query<any[]>(
        'SELECT id, email FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
        [token]
      );

      if (rows.length === 0) {
        res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
        return;
      }

      const user: any = rows[0];

      // Update password (using usersService which handles hashing)
      await usersService.updateUser(user.id, { password } as any);

      // Clear reset token
      await db.query(
        'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
        [user.id]
      );

      res.json({ success: true, message: 'Password has been reset successfully. Please login.' });
    } catch (error) {
      console.error('Error processing password reset:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  /**
   * Customer login
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, cf_turnstile_response, skip_turnstile } = req.body;

      // Skip turnstile only for in-page login (e.g. header dropdown on cart/shop) when explicitly requested
      const requireTurnstile = envConfig.turnstileSecretKey && !skip_turnstile;
      if (requireTurnstile && !cf_turnstile_response) {
        res.status(400).json({ error: 'Please complete the security verification' });
        return;
      }
      if (requireTurnstile && cf_turnstile_response) {
        const valid = await verifyTurnstileToken(cf_turnstile_response, req.ip || (req.socket as any)?.remoteAddress);
        if (!valid) {
          res.status(400).json({ error: 'Security verification failed. Please try again.' });
          return;
        }
      }

      const user = await usersService.authenticateUser(email, password);

      if (user) {
        // Set session
        (req.session as any).user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };

        // Merge session cart with customer cart
        const sessionId = req.sessionID;
        const sessionCart = await cartService.getOrCreateSessionCart(sessionId);
        if (sessionCart.items && sessionCart.items.length > 0) {
          await cartService.mergeCarts(sessionCart.id, user.id);
        }

        // Merge session wishlist with customer wishlist
        // 1. Get session wishlist items
        const [sessionWishlist] = await db.query<any[]>(
           'SELECT product_id, variant_id FROM wishlists WHERE session_id = ? AND customer_id IS NULL',
           [sessionId]
        );

        if (sessionWishlist.length > 0) {
            for (const item of sessionWishlist as any[]) {
                // 2. Insert into customer wishlist (IGNORE duplicates)
                await db.query(
                    'INSERT IGNORE INTO wishlists (customer_id, product_id, variant_id) VALUES (?, ?, ?)',
                    [user.id, item.product_id, item.variant_id]
                );
            }
            // 3. Delete session wishlist
            await db.query('DELETE FROM wishlists WHERE session_id = ? AND customer_id IS NULL', [sessionId]);
        }

        res.json({ success: true, user });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Error logging in customer:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * Customer logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.json({ success: true });
      });
    } catch (error) {
      console.error('Error logging out:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * Customer logout (redirect)
   */
  public static async logoutRedirect(req: Request, res: Response): Promise<void> {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/');
      });
    } catch (error) {
      console.error('Error logging out:', error);
      res.redirect('/');
    }
  }

  /**
   * Get customer profile
   */
  public static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await usersService.getUserById(customerId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  /**
   * Update customer profile
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { name, email, phone } = req.body;
      await usersService.updateUser(customerId, { name, email, phone } as any);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Get customer orders
   */
  public static async getOrders(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orders = await orderService.getCustomerOrders(customerId);
      res.json({ orders });
    } catch (error) {
      console.error('Error getting orders:', error);
      res.status(500).json({ error: 'Failed to get orders' });
    }
  }

  /**
   * Get order details
   */
  public static async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const { orderId } = req.params;

      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const order = await orderService.getOrderWithItems(parseInt(orderId));

      if (!order || order.customer_id !== customerId) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json({ order });
    } catch (error) {
      console.error('Error getting order:', error);
      res.status(500).json({ error: 'Failed to get order' });
    }
  }

  /**
   * Track order shipment (Aramex TrackShipments). Verifies order belongs to logged-in customer.
   * GET or POST /api/customer/orders/:orderId/track
   */
  public static async trackOrder(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        res.status(400).json({ success: false, error: 'Invalid order' });
        return;
      }

      const order = await orderService.getOrderWithItems(orderId);
      if (!order || order.customer_id !== customerId) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      let trackingNumber = (order as any).tracking_number ?? null;
      if (!trackingNumber) {
        const shipment = await shipmentService.getShipmentByOrderId(orderId);
        trackingNumber = shipment?.tracking_number ?? null;
      }
      if (!trackingNumber || !String(trackingNumber).trim()) {
        res.status(400).json({ success: false, error: 'No tracking number for this order.' });
        return;
      }

      const result = await trackShipmentsJson([String(trackingNumber).trim()], false);
      if (result.HasErrors) {
        const notifs = result.Notifications as { Notification?: Array<{ Code?: string; Message?: string }> } | undefined;
        const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => n?.Message).filter(Boolean).join('; ') : 'Tracking unavailable';
        res.json({ success: false, error: msg, trackingResults: result.TrackingResults });
        return;
      }

      res.json({
        success: true,
        trackingNumber: String(trackingNumber).trim(),
        trackingResults: result.TrackingResults
      });
    } catch (error) {
      console.error('Error tracking order:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tracking information'
      });
    }
  }

  /**
   * Get customer addresses
   */
  public static async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const [rows] = await db.query<any>(
        'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
        [customerId]
      );

      // Decrypt addresses
      const addresses = rows.map(row => {
        if (row.content_encrypted && row.iv) {
          try {
            const decryptedData = encryptionService.decrypt(row.content_encrypted, row.iv);
            if (decryptedData) {
              return { ...row, ...decryptedData };
            }
          } catch (e) {
            console.error('Failed to decrypt address:', e);
          }
        }
        return row;
      });

      res.json({ addresses });
    } catch (error) {
      console.error('Error getting addresses:', error);
      res.status(500).json({ error: 'Failed to get addresses' });
    }
  }

  /**
   * Add customer address
   */
  public static async addAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const {
        type,
        first_name,
        last_name,
        company,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        phone,
        is_default
      } = req.body;

      // Prepare PII data for encryption
      const piiData = {
        first_name,
        last_name,
        company,
        address_line_1,
        address_line_2,
        phone
      };

      const { content: contentEncrypted, iv } = encryptionService.encrypt(piiData);

      // If setting as default, unset other defaults
      if (is_default) {
        await db.query(
          'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ? AND type = ?',
          [customerId, type || 'shipping']
        );
      }

      const [result] = await db.query<any>(
        `INSERT INTO customer_addresses (
          customer_id, type, city, state, postal_code, country, is_default, content_encrypted, iv
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId, type || 'shipping', city, state, postal_code, country,
          is_default ? 1 : 0, contentEncrypted, iv
        ]
      );

      res.json({ success: true, addressId: (result as any).insertId });
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ error: 'Failed to add address' });
    }
  }

  /**
   * Update customer address
   */
  public static async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const { addressId } = req.params;

      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Verify ownership
      const [rows] = await db.query<any>(
        'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
        [addressId, customerId]
      );

      if (!rows || rows.length === 0) {
        res.status(404).json({ error: 'Address not found' });
        return;
      }

      const {
        type,
        first_name,
        last_name,
        company,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        phone,
        is_default
      } = req.body;

      // Prepare PII data for encryption
      const piiData = {
        first_name,
        last_name,
        company,
        address_line_1,
        address_line_2,
        phone
      };

      const { content: contentEncrypted, iv } = encryptionService.encrypt(piiData);

      // If setting as default, unset other defaults
      if (is_default) {
        await db.query(
          'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ? AND type = ?',
          [customerId, type || 'shipping']
        );
      }

      await db.query(
        `UPDATE customer_addresses SET 
          type = ?, city = ?, state = ?, postal_code = ?, country = ?, 
          is_default = ?, content_encrypted = ?, iv = ?, updated_at = NOW()
        WHERE id = ? AND customer_id = ?`,
        [
          type || 'shipping', city, state, postal_code, country,
          is_default ? 1 : 0, contentEncrypted, iv,
          addressId, customerId
        ]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({ error: 'Failed to update address' });
    }
  }

  /**
   * Delete customer address
   */
  public static async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const { addressId } = req.params;

      if (!customerId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      await db.query(
        'DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?',
        [addressId, customerId]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ error: 'Failed to delete address' });
    }
  }

  /**
   * Get wishlist
   */
  /**
   * Get wishlist
   */
  public static async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const sessionId = req.sessionID;
      
      let query = `SELECT w.*, p.name as product_name, p.slug as product_slug, p.price,
         (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
         FROM wishlists w
         LEFT JOIN products p ON w.product_id = p.id
         WHERE `;
      let params = [];
      
      if (customerId) {
        query += 'w.customer_id = ?';
        params.push(customerId);
      } else {
        query += 'w.session_id = ? AND w.customer_id IS NULL';
        params.push(sessionId);
      }
      
      query += ' ORDER BY w.created_at DESC';

      const [rows] = await db.query<any[]>(query, params);

      res.json({ wishlist: rows });
    } catch (error) {
      console.error('Error getting wishlist:', error);
      res.status(500).json({ error: 'Failed to get wishlist' });
    }
  }

  /**
   * Add to wishlist
   */
  public static async addToWishlist(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const sessionId = req.sessionID;
      const { product_id } = req.body;

      if (customerId) {
        await db.query(
          'INSERT IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)',
          [customerId, product_id]
        );
      } else {
         await db.query(
          'INSERT IGNORE INTO wishlists (session_id, product_id) VALUES (?, ?)',
          [sessionId, product_id]
        );
      }

      res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
    }
  }

  /**
   * Remove from wishlist
   */
  public static async removeFromWishlist(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).user?.id;
      const sessionId = req.sessionID;
      const { product_id } = req.body;

      if (customerId) {
        await db.query(
          'DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?',
          [customerId, product_id]
        );
      } else {
        await db.query(
          'DELETE FROM wishlists WHERE session_id = ? AND product_id = ?',
          [sessionId, product_id]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      res.status(500).json({ error: 'Failed to remove from wishlist' });
    }
  }

  /**
   * Delete old session wishlists (cleanup)
   */
  public static async deleteOldSessionWishlists(daysOld: number = 30): Promise<number> {
    try {
      const [result] = await db.query<any>(
        `DELETE FROM wishlists 
         WHERE customer_id IS NULL 
         AND session_id IS NOT NULL 
         AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [daysOld]
      );
      return (result as any).affectedRows || 0;
    } catch (error) {
      console.error('Error deleting old session wishlists:', error);
      return 0;
    }
  }
}

