import { Request, Response, NextFunction } from 'express';

export interface MemberSession {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

export interface ImpersonatorSession {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

declare module 'express-session' {
  interface SessionData {
    member?: MemberSession | undefined;
    memberLoginRedirect?: string | undefined;
    /** Super Admin who started a member-portal preview */
    impersonator?: ImpersonatorSession | undefined;
    user?: {
      id: number;
      name: string;
      email?: string;
      phone?: string;
      role: string;
    };
  }
}

/** Only allow post-login redirects under /account (no open redirects). */
export function safeAccountRedirect(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value.startsWith('/account')) return null;
  if (value.startsWith('//') || value.includes('\\') || value.includes('://')) return null;
  return value;
}

export function requireMember(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.member?.id) {
    next();
    return;
  }
  const wantsJson =
    req.xhr ||
    req.headers.accept?.includes('application/json') ||
    req.headers['content-type']?.includes('application/json');
  if (wantsJson) {
    res.status(401).json({ success: false, message: 'Please sign in.' });
    return;
  }
  const returnTo = safeAccountRedirect(req.originalUrl);
  if (returnTo) {
    res.redirect(`/account/login?redirect=${encodeURIComponent(returnTo)}`);
    return;
  }
  res.redirect('/account/login');
}

export function redirectIfMember(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.member?.id) {
    const redirect = safeAccountRedirect(req.query.redirect) || '/account';
    res.redirect(redirect);
    return;
  }
  next();
}

export function getMemberSession(req: Request): MemberSession | null {
  return req.session?.member || null;
}
