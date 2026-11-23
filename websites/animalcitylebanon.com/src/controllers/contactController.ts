import type { Request, Response } from 'express';
import { BadRequestError } from '../errors/httpError.js';
import { contactFormSchema } from '../schemas/contactSchemas.js';
import { captchaService } from '../services/captchaService.js';
import { contactService } from '../services/contactService.js';

function fieldErrorsFromZod(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export class ContactController {
  public static async submit(req: Request, res: Response): Promise<void> {
    const parsed = contactFormSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Please correct the highlighted fields.', fieldErrorsFromZod(parsed.error));
    }

    if (!parsed.data.website) {
      captchaService.verify(parsed.data.captcha, 'contact', req.ip ?? '');
    }

    await contactService.submit(parsed.data);
    res.json({ success: true, message: 'Thank you. Your message was sent.' });
  }
}
