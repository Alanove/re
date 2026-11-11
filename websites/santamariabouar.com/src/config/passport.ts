import crypto from 'crypto';
import { Request } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { usersService } from '../../admin/services/usersService';

/**
 * Same session key passport-oauth2 uses for accounts.google.com when `state: true`.
 * Saving before the redirect keeps the state available when Google returns quickly.
 */
const GOOGLE_OAUTH_STATE_KEY = 'oauth2:accounts.google.com';
const SESSION_COOKIE_NAME = 'smb.sid';
const DEFAULT_SESSION_SECRET = 'lw-njs-cms-admin-secret';
const PENDING_GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStateBag = { state?: string };

interface PendingGoogleOAuth {
  sessionId: string;
  redirect?: string;
  expiresAt: number;
}

/**
 * Survives a session overwrite while the browser is at Google.
 * The value is single-use and tied to the session that started the login.
 */
const pendingGoogleOAuth = new Map<string, PendingGoogleOAuth>();

function oauthStateSession(req: Request): Record<string, OAuthStateBag | undefined> {
  return req.session as unknown as Record<string, OAuthStateBag | undefined>;
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const prefix = `${name}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return trimmed.slice(prefix.length);
    }
  }
  return undefined;
}

function unsignCookie(input: string, secret: string): string | undefined {
  const dot = input.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const value = input.slice(0, dot);
  const expected = `${value}.${crypto.createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '')}`;
  const expectedBuffer = Buffer.from(expected);
  const inputBuffer = Buffer.from(input);
  if (expectedBuffer.length !== inputBuffer.length || !crypto.timingSafeEqual(expectedBuffer, inputBuffer)) {
    return undefined;
  }
  return value;
}

/** Session id from the smb.sid cookie, before express-session replaces a missing session. */
function cookieSessionId(req: Request): string | undefined {
  const raw = cookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!raw || !raw.startsWith('s:')) return undefined;
  return unsignCookie(raw.slice(2), sessionSecret());
}

function sessionBagState(req: Request): string | undefined {
  const state = oauthStateSession(req)[GOOGLE_OAUTH_STATE_KEY]?.state;
  return typeof state === 'string' && state.length > 0 ? state : undefined;
}

function readPending(state: string): PendingGoogleOAuth | undefined {
  const pending = pendingGoogleOAuth.get(state);
  if (!pending) return undefined;
  if (pending.expiresAt <= Date.now()) {
    pendingGoogleOAuth.delete(state);
    return undefined;
  }
  return pending;
}

function pendingAllows(req: Request, pending: PendingGoogleOAuth): boolean {
  const cookieSid = cookieSessionId(req);
  if (!cookieSid || cookieSid !== req.sessionID) return true;
  return cookieSid === pending.sessionId;
}

function clearSessionBag(req: Request): void {
  const session = oauthStateSession(req);
  delete session[GOOGLE_OAUTH_STATE_KEY];
}

export function googleCallbackCanAuthenticate(req: Request, providedState: string): boolean {
  if (!providedState) return false;
  if (sessionBagState(req) === providedState) return true;
  const pending = readPending(providedState);
  return Boolean(pending && pendingAllows(req, pending));
}

class SavingSessionStateStore {
  store(req: Request, callback: (err: Error | null, state?: string) => void): void {
    if (!req.session) {
      callback(new Error('OAuth 2.0 authentication requires session support when using state.'));
      return;
    }

    const state = crypto.randomBytes(18).toString('base64url');
    const session = oauthStateSession(req);
    const existing = session[GOOGLE_OAUTH_STATE_KEY] || {};
    existing.state = state;
    session[GOOGLE_OAUTH_STATE_KEY] = existing;

    const redirect = (req.session as { memberLoginRedirect?: string }).memberLoginRedirect;
    pendingGoogleOAuth.set(state, {
      sessionId: req.sessionID,
      ...(typeof redirect === 'string' && redirect ? { redirect } : {}),
      expiresAt: Date.now() + PENDING_GOOGLE_STATE_TTL_MS
    });

    req.session.save((err) => {
      if (err) {
        pendingGoogleOAuth.delete(state);
        callback(err instanceof Error ? err : new Error('Failed to save OAuth state'));
        return;
      }
      callback(null, state);
    });
  }

  verify(
    req: Request,
    providedState: string,
    callback: (err: Error | null, ok: boolean, info?: { message: string }) => void
  ): void {
    if (!req.session) {
      callback(new Error('OAuth 2.0 authentication requires session support when using state.'), false);
      return;
    }

    const state = typeof providedState === 'string' ? providedState : '';
    const pending = state ? readPending(state) : undefined;
    const bagMatches = Boolean(state) && sessionBagState(req) === state;
    const mapAllows = Boolean(pending && pendingAllows(req, pending));

    if (!bagMatches && !mapAllows) {
      const message = pending
        ? 'Invalid authorization request state.'
        : 'Unable to verify authorization request state.';
      callback(null, false, { message });
      return;
    }

    if (pending) pendingGoogleOAuth.delete(state);
    if (pending?.redirect) {
      const sessionWithRedirect = req.session as { memberLoginRedirect?: string };
      if (!sessionWithRedirect.memberLoginRedirect) {
        sessionWithRedirect.memberLoginRedirect = pending.redirect;
      }
    }
    clearSessionBag(req);

    req.session.save((err) => {
      if (err) {
        if (pending) pendingGoogleOAuth.set(state, pending);
        callback(err instanceof Error ? err : new Error('Failed to save OAuth state'), false);
        return;
      }
      callback(null, true);
    });
  }
}

export function configurePassport(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:3002/account/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn(
      '[passport] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        // Passport selects the store from `store.length`; keep the 2-arg methods and assert the type.
        store: new SavingSessionStateStore() as unknown as NonNullable<
          ConstructorParameters<typeof GoogleStrategy>[0]['store']
        >
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: any, user?: any, info?: object) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { reason: 'no-email' });
          }

          const user = await usersService.getUserByEmail(email);
          if (!user || user.status !== 'Active') {
            return done(null, false, { reason: 'no-member' });
          }

          if (profile.id) {
            await usersService.setGoogleId(user.id, profile.id);
          }

          return done(null, {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          });
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

export { passport };
