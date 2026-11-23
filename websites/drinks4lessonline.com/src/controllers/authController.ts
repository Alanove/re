import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import oauthService from '../services/oauthService';
import { OAuthProfile } from '../services/oauthService';
import cartService from '../services/cartService';

export class AuthController {
  /**
   * OAuth login initiation - Google
   */
  public static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Google sign-in is not configured'));
        return;
      }
      if (req.query.redirect) {
        (req.session as any).oauthRedirect = req.query.redirect as string;
      }
      const state = randomBytes(16).toString('hex');
      (req.session as any).googleOauthState = state;
      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL
        || `${process.env.APP_URL || ''}/auth/google/callback`;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      res.redirect(url.toString());
    } catch (error) {
      console.error('Error initiating Google login:', error);
      res.status(500).json({ error: 'Failed to initiate Google login' });
    }
  }

  /**
   * OAuth callback - Google
   */
  public static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error, state } = req.query;
      if (error) {
        res.redirect('/customer/login?error=' + encodeURIComponent(String(error)));
        return;
      }
      const expected = (req.session as any).googleOauthState;
      if (!code || !state || !expected || state !== expected) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Google sign-in could not be verified'));
        return;
      }
      delete (req.session as any).googleOauthState;
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL
        || `${process.env.APP_URL || ''}/auth/google/callback`;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      if (!tokenResponse.ok) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Google sign-in was rejected'));
        return;
      }
      const token = await tokenResponse.json() as { access_token?: string };
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token || ''}` }
      });
      if (!profileResponse.ok) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Google profile could not be read'));
        return;
      }
      const google = await profileResponse.json() as { id?: string; email?: string; name?: string; picture?: string };
      if (!google.id || !google.email) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Google did not return an email address'));
        return;
      }
      const profile: OAuthProfile = {
        provider: 'google',
        providerId: google.id,
        email: google.email,
        name: google.name || google.email
      };
      if (google.picture) profile.picture = google.picture;
      const user = await oauthService.findOrCreateUser(profile, 'customer');
      if (!user) {
        res.redirect('/customer/login?error=' + encodeURIComponent('Could not sign in with Google'));
        return;
      }
      (req.session as any).user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      const sessionCart = await cartService.getOrCreateSessionCart(req.sessionID);
      if (sessionCart.items && sessionCart.items.length > 0) {
        await cartService.mergeCarts(sessionCart.id, user.id);
      }
      const nextUrl = (req.session as any).oauthRedirect || '/customer/account';
      delete (req.session as any).oauthRedirect;
      res.redirect(typeof nextUrl === 'string' && nextUrl.startsWith('/') ? nextUrl : '/customer/account');
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
    }
  }

  /**
   * OAuth login initiation - Microsoft/Office 365
   */
  public static async microsoftLogin(req: Request, res: Response): Promise<void> {
    try {
      if (req.query.redirect) {
        (req.session as any).oauthRedirect = req.query.redirect as string;
      }

      const redirectUrl = process.env.MICROSOFT_OAUTH_REDIRECT_URL || '/auth/microsoft/callback';
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error initiating Microsoft login:', error);
      res.status(500).json({ error: 'Failed to initiate Microsoft login' });
    }
  }

  /**
   * OAuth callback - Microsoft
   */
  public static async microsoftCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect('/customer/login?error=' + encodeURIComponent(error as string));
      }

      // In production, exchange code for access token and get user profile
      res.redirect('/customer/login?error=OAuth+not+fully+configured');
    } catch (error) {
      console.error('Error in Microsoft OAuth callback:', error);
      res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
    }
  }

  /**
   * OAuth login initiation - Facebook
   */
  public static async facebookLogin(req: Request, res: Response): Promise<void> {
    try {
      if (req.query.redirect) {
        (req.session as any).oauthRedirect = req.query.redirect as string;
      }

      const redirectUrl = process.env.FACEBOOK_OAUTH_REDIRECT_URL || '/auth/facebook/callback';
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error initiating Facebook login:', error);
      res.status(500).json({ error: 'Failed to initiate Facebook login' });
    }
  }

  /**
   * OAuth callback - Facebook
   */
  public static async facebookCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect('/customer/login?error=' + encodeURIComponent(error as string));
      }

      // In production, exchange code for access token and get user profile
      res.redirect('/customer/login?error=OAuth+not+fully+configured');
    } catch (error) {
      console.error('Error in Facebook OAuth callback:', error);
      res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
    }
  }

  /**
   * Process OAuth profile and login user
   * This is called after receiving OAuth profile data
   */
  public static async processOAuthProfile(
    req: Request,
    res: Response,
    profile: OAuthProfile
  ): Promise<void> {
    try {
      const role = (req.query.role as string) || 'customer';
      const user = await oauthService.findOrCreateUser(profile, role);

      if (!user) {
        return res.redirect('/customer/login?error=' + encodeURIComponent('Failed to create user account'));
      }

      // Set session
      (req.session as any).user = {
        id: user.id,
        name: user.name || profile.name,
        email: user.email,
        role: user.role
      };

      // Redirect to intended page or account page
      const redirectUrl = (req.session as any).oauthRedirect || '/customer/account';
      delete (req.session as any).oauthRedirect;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error processing OAuth profile:', error);
      res.redirect('/customer/login?error=' + encodeURIComponent('Failed to process OAuth login'));
    }
  }
}
