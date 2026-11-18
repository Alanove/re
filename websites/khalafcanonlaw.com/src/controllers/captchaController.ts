import type { Request, Response } from 'express';
import { BadRequestError } from '../errors/httpError.js';
import { captchaChallengeQuerySchema } from '../schemas/captchaSchemas.js';
import { captchaService } from '../services/captchaService.js';

export class CaptchaController {
  public static challenge(req: Request, res: Response): void {
    const parsed = captchaChallengeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Unknown form.');
    }
    res.set('Cache-Control', 'no-store');
    res.json(captchaService.challenge(parsed.data.scope));
  }
}
