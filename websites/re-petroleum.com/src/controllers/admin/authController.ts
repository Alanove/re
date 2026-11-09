import type { Request, Response } from 'express';
import { devLoginCredentials, isDevelopment } from '../../config/env.js';
import { HttpError, NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { loginSchema } from '../../schemas/adminSchemas.js';
import { usersService } from '../../services/usersService.js';

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('Session regeneration failed'));
      } else {
        resolve();
      }
    });
  });
}

function destroy(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('Session destroy failed'));
      } else {
        resolve();
      }
    });
  });
}

function safeReturnTo(value: string | undefined): string {
  return value && value.startsWith('/admin/') && !value.startsWith('//') && !value.startsWith('/admin/login') ? value : '/admin/dashboard';
}

function renderLogin(res: Response, status: number, error: string | null, email: string): void {
  res.status(status).render('auth/login', {
    layout: false,
    error,
    email,
    devLogin: devLoginCredentials !== null
  });
}

async function establishSession(req: Request, userId: number): Promise<string> {
  const returnTo = safeReturnTo(req.session.returnTo);
  await regenerate(req);
  req.session.userId = userId;
  return returnTo;
}

export class AuthController {
  public static showLogin(req: Request, res: Response): void {
    if (req.currentUser) {
      res.redirect('/admin/dashboard');
      return;
    }
    renderLogin(res, 200, null, '');
  }

  public static async login(req: Request, res: Response): Promise<void> {
    const parsed = safeParseFields(loginSchema, req.body);
    const email = typeof (req.body as { email?: unknown }).email === 'string' ? (req.body as { email: string }).email : '';
    if (!parsed.ok) {
      renderLogin(res, 400, 'Enter your email address and password.', email);
      return;
    }
    try {
      const user = await usersService.authenticate(parsed.data.email, parsed.data.password);
      const returnTo = await establishSession(req, user.id);
      res.redirect(returnTo);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        renderLogin(res, 401, error.message, email);
        return;
      }
      throw error;
    }
  }

  public static async devLogin(req: Request, res: Response): Promise<void> {
    if (!isDevelopment || !devLoginCredentials) {
      throw new NotFoundError();
    }
    try {
      const user = await usersService.authenticate(devLoginCredentials.email, devLoginCredentials.password);
      const returnTo = await establishSession(req, user.id);
      res.redirect(returnTo);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        renderLogin(res, 401, 'Dev login failed. Check ADMIN_EMAIL and ADMIN_PASSWORD, then run npm run seed:admin.', devLoginCredentials.email);
        return;
      }
      throw error;
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    await destroy(req);
    res.clearCookie(String(req.app.locals.sessionCookieName), { path: '/' });
    res.redirect('/admin/login');
  }
}
