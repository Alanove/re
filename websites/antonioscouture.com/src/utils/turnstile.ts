import { integrationSettingsService } from '../../admin/services/integrationSettingsService';

async function verifyWithSecret(
  token: string,
  secret: string,
  remoteip?: string
): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteip) formData.append('remoteip', remoteip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (!data.success && data['error-codes']?.length) {
    console.warn('[Turnstile] Verification failed:', data['error-codes']);
  }
  return data.success === true;
}

/** Site key to render the widget with, or undefined when Turnstile is disabled / not configured. */
export async function getTurnstileSiteKey(): Promise<string | undefined> {
  const active = await integrationSettingsService.getActiveTurnstile();
  return active?.siteKey;
}

/** Whether forms must include a valid Turnstile token. */
export async function isTurnstileEnabled(): Promise<boolean> {
  return (await integrationSettingsService.getActiveTurnstile()) !== null;
}

/**
 * Verify Cloudflare Turnstile token. Returns true if Turnstile is disabled / not configured.
 */
export async function verifyTurnstileToken(token: string, remoteip?: string): Promise<boolean> {
  const active = await integrationSettingsService.getActiveTurnstile();
  if (!active) return true;
  if (!token || typeof token !== 'string') return false;
  try {
    return await verifyWithSecret(token, active.secretKey, remoteip);
  } catch (error) {
    console.error('[Turnstile] Verify error:', error);
    return false;
  }
}
