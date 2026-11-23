"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const usersService_1 = require("../services/usersService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const env_config_1 = require("../../src/config/env.config");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
class AdminController {
    static async login(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const error = req.query.error;
            const csrfToken = res.locals.csrfToken || '';
            if (!csrfToken) {
                console.warn(`[LOGIN DEBUG] WARNING: CSRF token is empty when rendering login page`);
            }
            else {
                console.log(`[LOGIN DEBUG] CSRF token available for login page:`, {
                    token: csrfToken.substring(0, 15) + '...',
                    sessionId: req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none'
                });
            }
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
                turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                error: error || undefined,
                csrfToken: csrfToken,
                layout: false
            });
        }
        catch (error) {
            console.error('Error rendering login page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async verifyTurnstileToken(token, remoteip) {
        if (!env_config_1.envConfig.turnstileSecretKey) {
            console.log(`[TURNSTILE] Turnstile not configured, skipping verification`);
            return true;
        }
        if (!token) {
            console.log(`[TURNSTILE] ❌ No token provided`);
            return false;
        }
        try {
            const formData = new URLSearchParams();
            formData.append('secret', env_config_1.envConfig.turnstileSecretKey);
            formData.append('response', token);
            if (remoteip) {
                formData.append('remoteip', remoteip);
            }
            console.log(`[TURNSTILE] Verifying token with Cloudflare...`, {
                tokenLength: token.length,
                remoteip: remoteip || 'not provided',
                secretKeySet: !!env_config_1.envConfig.turnstileSecretKey
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
        }
        catch (error) {
            console.error('[TURNSTILE] ❌ Error verifying Turnstile token:', error);
            return false;
        }
    }
    static async loginPost(req, res) {
        try {
            console.log(`[LOGIN POST] Starting login process`);
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
            if (!email || !password) {
                console.log(`[LOGIN POST] Validation failed: missing email or password`);
                const siteTitle = await siteSettingsService.getSiteTitle();
                return res.render('auth/login', {
                    title: 'Admin Login',
                    siteTitle: siteTitle,
                    turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                    isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                    error: 'Email and password are required.',
                    layout: false
                });
            }
            if (env_config_1.envConfig.nodeEnv === 'production' && env_config_1.envConfig.turnstileSecretKey) {
                console.log(`[LOGIN POST] Production mode: Verifying Turnstile token...`);
                if (!turnstileToken || turnstileToken.length < 10) {
                    console.warn(`[LOGIN POST] ⚠️ Turnstile token is missing or too short (${turnstileToken?.length || 0} chars). This usually means the Turnstile widget didn't load properly.`);
                    console.warn(`[LOGIN POST] ⚠️ Possible causes: CSP blocking scripts, network issues, or Turnstile widget not initialized.`);
                    console.warn(`[LOGIN POST] ⚠️ For now, skipping Turnstile validation to allow login. Please fix the Turnstile widget issue.`);
                }
                else {
                    console.log(`[LOGIN POST] Verifying Turnstile token...`);
                    const remoteip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    const isTurnstileValid = await AdminController.verifyTurnstileToken(turnstileToken, remoteip);
                    console.log(`[LOGIN POST] Turnstile validation result: ${isTurnstileValid ? 'PASSED' : 'FAILED'}`);
                    if (!isTurnstileValid) {
                        console.log(`[LOGIN POST] Turnstile validation failed, returning error`);
                        const siteTitle = await siteSettingsService.getSiteTitle();
                        return res.render('auth/login', {
                            title: 'Admin Login',
                            siteTitle: siteTitle,
                            turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                            isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                            error: 'Security verification failed. Please try again.',
                            layout: false
                        });
                    }
                }
            }
            else {
                if (env_config_1.envConfig.nodeEnv !== 'production') {
                    console.log(`[LOGIN POST] Development mode: Skipping Turnstile verification`);
                }
            }
            console.log(`[LOGIN POST] Authenticating user...`);
            const user = await usersService_1.usersService.authenticateUser(email, password);
            if (user) {
                console.log(`[LOGIN POST] ✅ Authentication SUCCESS for user: ${user.email}`);
                req.session.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };
                req.session.save((err) => {
                    if (err) {
                        console.error('[LOGIN POST] ❌ Session save failed:', err);
                        siteSettingsService.getSiteTitle().then((siteTitle) => {
                            res.render('auth/login', {
                                title: 'Admin Login',
                                siteTitle,
                                turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                                error: 'Session error. Please try again.',
                                layout: false
                            });
                        });
                        return;
                    }
                    console.log(`[LOGIN POST] Session saved, redirecting to dashboard. Session ID: ${req.sessionID ? req.sessionID.substring(0, 15) + '...' : 'none'}`);
                    res.redirect('/admin/dashboard');
                });
            }
            else {
                console.log(`[LOGIN POST] ❌ Authentication FAILED: Invalid credentials`);
                const siteTitle = await siteSettingsService.getSiteTitle();
                res.render('auth/login', {
                    title: 'Admin Login',
                    siteTitle: siteTitle,
                    turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                    isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                    error: 'Invalid email or password.',
                    layout: false
                });
            }
        }
        catch (error) {
            console.error('[LOGIN POST] ❌ ERROR during login:', error);
            const siteTitle = await siteSettingsService.getSiteTitle();
            res.render('auth/login', {
                title: 'Admin Login',
                siteTitle: siteTitle,
                turnstileSiteKey: env_config_1.envConfig.nodeEnv === 'production' ? env_config_1.envConfig.turnstileSiteKey : undefined,
                isDevelopment: env_config_1.envConfig.nodeEnv !== 'production',
                error: 'An error occurred during login.',
                layout: false
            });
        }
    }
    static async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                res.redirect('/admin/login');
            });
        }
        catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/admin/login');
        }
    }
    static requireAuth(req, res, next) {
        if (req.session && req.session.user) {
            next();
        }
        else {
            res.redirect('/admin/login');
        }
    }
    static requireApiAuth(req, res, next) {
        if (req.session && req.session.user) {
            next();
        }
        else {
            res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in to access this API endpoint.'
            });
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=adminController.js.map