import { env } from '../config/env.js';
import { HttpError } from '../errors/httpError.js';
import type { CaptchaScope } from '../schemas/captchaSchemas.js';
import { createChallenge, MemoryReplayStore, verifyCaptcha, type CaptchaChallenge } from '../vendor/captcha/captcha.js';

export const CAPTCHA_FAILED_MESSAGE = 'The spam check did not complete. Please wait a moment and send the form again.';

export class CaptchaService {
  private readonly replayStore = new MemoryReplayStore();

  public challenge(scope: CaptchaScope): CaptchaChallenge {
    return createChallenge({ secret: env.CAPTCHA_SECRET, scope, maxNumber: env.CAPTCHA_DIFFICULTY });
  }

  /** Throws a 400 with a `captcha` field error unless the token is a fresh, unused solution for this scope. */
  public verify(token: string, scope: CaptchaScope, ip: string): void {
    const result = verifyCaptcha(token, { secret: env.CAPTCHA_SECRET, scope, replayStore: this.replayStore });
    if (!result.ok) {
      console.warn('Captcha rejected', { scope, reason: result.reason, ip });
      throw new HttpError(400, CAPTCHA_FAILED_MESSAGE, { fields: { captcha: CAPTCHA_FAILED_MESSAGE } });
    }
  }
}

export const captchaService = new CaptchaService();
