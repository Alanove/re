import { createChallenge, MemoryReplayStore, verifyCaptcha, type CaptchaChallenge } from '../vendor/captcha/captcha';

export const CAPTCHA_SCOPES = ['admin-login', 'contact'] as const;
export type CaptchaScope = (typeof CAPTCHA_SCOPES)[number];

export const CAPTCHA_FAILED_MESSAGE = 'The spam check did not complete. Please wait a moment and send the form again.';

const DEFAULT_DIFFICULTY = 100_000;

export function isCaptchaScope(value: unknown): value is CaptchaScope {
  return typeof value === 'string' && (CAPTCHA_SCOPES as readonly string[]).includes(value);
}

export class CaptchaService {
  private static instance: CaptchaService;
  private readonly replayStore = new MemoryReplayStore();

  public static getInstance(): CaptchaService {
    if (!CaptchaService.instance) {
      CaptchaService.instance = new CaptchaService();
    }
    return CaptchaService.instance;
  }

  public challenge(scope: CaptchaScope): CaptchaChallenge {
    return createChallenge({ secret: this.secret(), scope, maxNumber: this.difficulty() });
  }

  /** True only for a fresh, unused solution issued for this scope. */
  public isValid(token: unknown, scope: CaptchaScope, ip: string): boolean {
    const result = verifyCaptcha(typeof token === 'string' ? token : '', {
      secret: this.secret(),
      scope,
      replayStore: this.replayStore
    });
    if (!result.ok) {
      console.warn('Captcha rejected', { scope, reason: result.reason, ip });
    }
    return result.ok;
  }

  private secret(): string {
    const secret = process.env.CAPTCHA_SECRET ?? '';
    if (secret.length < 32) {
      throw new Error('CAPTCHA_SECRET must be set to at least 32 characters.');
    }
    return secret;
  }

  private difficulty(): number {
    const value = Number(process.env.CAPTCHA_DIFFICULTY);
    return Number.isInteger(value) && value >= 1_000 && value <= 10_000_000 ? value : DEFAULT_DIFFICULTY;
  }
}
