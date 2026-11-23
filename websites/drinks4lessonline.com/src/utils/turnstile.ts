import { envConfig } from '../config/env.config';

/** Cloudflare always-pass test site key for non-production when env keys are unset. */
const TURNSTILE_DEV_SITE_KEY = '1x00000000000000000000AA';

/**
 * Site key for public Turnstile widgets. Uses env key, or the Cloudflare test key outside production.
 */
export function getTurnstileSiteKey(): string | undefined {
  return envConfig.turnstileSiteKey
    ?? (envConfig.nodeEnv !== 'production' ? TURNSTILE_DEV_SITE_KEY : undefined);
}

/**
 * Verify Cloudflare Turnstile token. Returns true if not configured or verification succeeds.
 */
export async function verifyTurnstileToken(token: string, remoteip?: string): Promise<boolean> {
  if (!envConfig.turnstileSecretKey) {
    return true;
  }
  if (!token || typeof token !== 'string') {
    return false;
  }
  try {
    const formData = new URLSearchParams();
    formData.append('secret', envConfig.turnstileSecretKey);
    formData.append('response', token);
    if (remoteip) formData.append('remoteip', remoteip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[Turnstile] Verify error:', error);
    return false;
  }
}
