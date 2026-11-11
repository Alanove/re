import { Request, Response, NextFunction } from 'express';

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export function getRecaptchaSiteKey(): string {
  return (process.env.RECAPTCHA_SITE_KEY || '').trim();
}

export function getRecaptchaSecretKey(): string {
  return (process.env.RECAPTCHA_SECRET_KEY || '').trim();
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(getRecaptchaSiteKey() && getRecaptchaSecretKey());
}

/**
 * In production, reCAPTCHA keys are required.
 * In development, missing keys skip verification (with a warning).
 */
export function shouldEnforceRecaptcha(): boolean {
  if (isRecaptchaConfigured()) {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

export async function verifyRecaptchaToken(
  token: string,
  remoteip?: string
): Promise<{ success: boolean; errorCodes?: string[] }> {
  const secret = getRecaptchaSecretKey();
  if (!secret) {
    return { success: false, errorCodes: ['missing-secret'] };
  }
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip) {
    body.set('remoteip', remoteip);
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = (await response.json()) as {
    success?: boolean;
    'error-codes'?: string[];
  };

  const result: { success: boolean; errorCodes?: string[] } = {
    success: Boolean(data.success)
  };
  if (data['error-codes']?.length) {
    result.errorCodes = data['error-codes'];
  }
  return result;
}

function extractToken(req: Request): string {
  const fromBody = req.body?.['g-recaptcha-response'];
  if (typeof fromBody === 'string') {
    return fromBody.trim();
  }
  const fromHeader = req.headers['x-recaptcha-token'];
  if (typeof fromHeader === 'string') {
    return fromHeader.trim();
  }
  return '';
}

/**
 * Express middleware: verify reCAPTCHA v2 Invisible response.
 */
export function requireRecaptcha(req: Request, res: Response, next: NextFunction): void {
  if (!isRecaptchaConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const wantsJson =
        req.xhr || req.headers.accept?.includes('application/json') === true;
      const message = 'Security verification is not configured. Please contact the administrator.';
      if (wantsJson) {
        res.status(503).json({ success: false, message });
        return;
      }
      res.status(503).send(message);
      return;
    }

    console.warn(
      '[recaptcha] RECAPTCHA_SITE_KEY / RECAPTCHA_SECRET_KEY not set — skipping verification in development'
    );
    next();
    return;
  }

  const token = extractToken(req);
  const remoteip = req.ip;

  verifyRecaptchaToken(token, remoteip)
    .then((result) => {
      if (!result.success) {
        console.warn('[recaptcha] verification failed:', result.errorCodes);
        const wantsJson =
          req.xhr || req.headers.accept?.includes('application/json') === true;
        const message = 'Security check failed. Please try again.';
        if (wantsJson) {
          res.status(400).json({ success: false, message });
          return;
        }
        res.status(400).send(message);
        return;
      }
      next();
    })
    .catch((error) => {
      console.error('[recaptcha] verification error:', error);
      const wantsJson =
        req.xhr || req.headers.accept?.includes('application/json') === true;
      const message = 'Security check failed. Please try again.';
      if (wantsJson) {
        res.status(500).json({ success: false, message });
        return;
      }
      res.status(500).send(message);
    });
}
