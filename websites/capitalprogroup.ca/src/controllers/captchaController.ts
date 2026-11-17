import { Request, Response } from 'express';
import { CaptchaService, isCaptchaScope } from '../services/captchaService';

const captchaService = CaptchaService.getInstance();

export class CaptchaController {
  public static challenge(req: Request, res: Response): void {
    const scope = req.query.scope;
    if (!isCaptchaScope(scope)) {
      res.status(400).json({ success: false, message: 'Unknown form.' });
      return;
    }
    try {
      res.set('Cache-Control', 'no-store').json(captchaService.challenge(scope));
    } catch (error) {
      console.error('Captcha challenge failed:', error);
      res.status(503).json({ success: false, message: 'Spam protection is not available right now. Please try again later.' });
    }
  }
}
