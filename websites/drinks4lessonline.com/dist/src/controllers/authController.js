"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const crypto_1 = require("crypto");
const oauthService_1 = __importDefault(require("../services/oauthService"));
const cartService_1 = __importDefault(require("../services/cartService"));
class AuthController {
    static async googleLogin(req, res) {
        try {
            const clientId = process.env.GOOGLE_CLIENT_ID || '';
            if (!clientId) {
                res.redirect('/customer/login?error=' + encodeURIComponent('Google sign-in is not configured'));
                return;
            }
            if (req.query.redirect) {
                req.session.oauthRedirect = req.query.redirect;
            }
            const state = (0, crypto_1.randomBytes)(16).toString('hex');
            req.session.googleOauthState = state;
            const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL
                || `${process.env.APP_URL || ''}/auth/google/callback`;
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('client_id', clientId);
            url.searchParams.set('redirect_uri', redirectUri);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('scope', 'openid email profile');
            url.searchParams.set('state', state);
            res.redirect(url.toString());
        }
        catch (error) {
            console.error('Error initiating Google login:', error);
            res.status(500).json({ error: 'Failed to initiate Google login' });
        }
    }
    static async googleCallback(req, res) {
        try {
            const { code, error, state } = req.query;
            if (error) {
                res.redirect('/customer/login?error=' + encodeURIComponent(String(error)));
                return;
            }
            const expected = req.session.googleOauthState;
            if (!code || !state || !expected || state !== expected) {
                res.redirect('/customer/login?error=' + encodeURIComponent('Google sign-in could not be verified'));
                return;
            }
            delete req.session.googleOauthState;
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
            const token = await tokenResponse.json();
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token.access_token || ''}` }
            });
            if (!profileResponse.ok) {
                res.redirect('/customer/login?error=' + encodeURIComponent('Google profile could not be read'));
                return;
            }
            const google = await profileResponse.json();
            if (!google.id || !google.email) {
                res.redirect('/customer/login?error=' + encodeURIComponent('Google did not return an email address'));
                return;
            }
            const profile = {
                provider: 'google',
                providerId: google.id,
                email: google.email,
                name: google.name || google.email
            };
            if (google.picture)
                profile.picture = google.picture;
            const user = await oauthService_1.default.findOrCreateUser(profile, 'customer');
            if (!user) {
                res.redirect('/customer/login?error=' + encodeURIComponent('Could not sign in with Google'));
                return;
            }
            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };
            const sessionCart = await cartService_1.default.getOrCreateSessionCart(req.sessionID);
            if (sessionCart.items && sessionCart.items.length > 0) {
                await cartService_1.default.mergeCarts(sessionCart.id, user.id);
            }
            const nextUrl = req.session.oauthRedirect || '/customer/account';
            delete req.session.oauthRedirect;
            res.redirect(typeof nextUrl === 'string' && nextUrl.startsWith('/') ? nextUrl : '/customer/account');
        }
        catch (error) {
            console.error('Error in Google OAuth callback:', error);
            res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
        }
    }
    static async microsoftLogin(req, res) {
        try {
            if (req.query.redirect) {
                req.session.oauthRedirect = req.query.redirect;
            }
            const redirectUrl = process.env.MICROSOFT_OAUTH_REDIRECT_URL || '/auth/microsoft/callback';
            res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Error initiating Microsoft login:', error);
            res.status(500).json({ error: 'Failed to initiate Microsoft login' });
        }
    }
    static async microsoftCallback(req, res) {
        try {
            const { code, error } = req.query;
            if (error) {
                return res.redirect('/customer/login?error=' + encodeURIComponent(error));
            }
            res.redirect('/customer/login?error=OAuth+not+fully+configured');
        }
        catch (error) {
            console.error('Error in Microsoft OAuth callback:', error);
            res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
        }
    }
    static async facebookLogin(req, res) {
        try {
            if (req.query.redirect) {
                req.session.oauthRedirect = req.query.redirect;
            }
            const redirectUrl = process.env.FACEBOOK_OAUTH_REDIRECT_URL || '/auth/facebook/callback';
            res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Error initiating Facebook login:', error);
            res.status(500).json({ error: 'Failed to initiate Facebook login' });
        }
    }
    static async facebookCallback(req, res) {
        try {
            const { code, error } = req.query;
            if (error) {
                return res.redirect('/customer/login?error=' + encodeURIComponent(error));
            }
            res.redirect('/customer/login?error=OAuth+not+fully+configured');
        }
        catch (error) {
            console.error('Error in Facebook OAuth callback:', error);
            res.redirect('/customer/login?error=' + encodeURIComponent('OAuth callback failed'));
        }
    }
    static async processOAuthProfile(req, res, profile) {
        try {
            const role = req.query.role || 'customer';
            const user = await oauthService_1.default.findOrCreateUser(profile, role);
            if (!user) {
                return res.redirect('/customer/login?error=' + encodeURIComponent('Failed to create user account'));
            }
            req.session.user = {
                id: user.id,
                name: user.name || profile.name,
                email: user.email,
                role: user.role
            };
            const redirectUrl = req.session.oauthRedirect || '/customer/account';
            delete req.session.oauthRedirect;
            res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Error processing OAuth profile:', error);
            res.redirect('/customer/login?error=' + encodeURIComponent('Failed to process OAuth login'));
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map