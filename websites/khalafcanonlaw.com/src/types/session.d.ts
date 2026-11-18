import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
    flash?: { type: 'success' | 'danger' | 'warning' | 'info'; message: string };
    returnTo?: string;
  }
}
