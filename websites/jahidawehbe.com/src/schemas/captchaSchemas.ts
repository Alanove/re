import { z } from 'zod';

export const CAPTCHA_SCOPES = ['admin-login'] as const;

export type CaptchaScope = (typeof CAPTCHA_SCOPES)[number];

export const captchaChallengeQuerySchema = z.object({
  scope: z.enum(CAPTCHA_SCOPES)
});

/** The solved proof-of-work token posted by the captcha widget; checked by captchaService. */
export const captchaField = z.string().max(2000).optional().default('');
