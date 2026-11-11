import { Request, Response } from 'express';
import * as fs from 'fs';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { EmailService } from '../services/emailService';

const siteSettingsService = SiteSettingsService.getInstance();
const emailService = EmailService.getInstance();

function trimField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveContactRecipients(): string[] {
  const email = siteSettingsService.getContactEmail().trim();
  if (email) {
    return [email];
  }
  return ['beirut.office@bluefieldco.com'];
}

function resolveCareersRecipients(): string[] {
  const careers = siteSettingsService.getCareersEmail().trim();
  const contact = siteSettingsService.getContactEmail().trim();
  const primary = careers || contact;
  if (primary) {
    return [primary];
  }
  return ['beirut.office@bluefieldco.com'];
}

function jsonError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

export class FormsController {
  public static async submitContact(req: Request, res: Response): Promise<void> {
    try {
      const fname = trimField(req.body.fname);
      const lname = trimField(req.body.lname);
      const name = trimField(req.body.name) || [fname, lname].filter(Boolean).join(' ').trim();
      const email = trimField(req.body.email);
      const phone = trimField(req.body.phone);
      const message = trimField(req.body.message);
      const source = trimField(req.body.source) || 'website';

      if (!name) {
        return jsonError(res, 400, 'Name is required.');
      }
      if (!email || !isValidEmail(email)) {
        return jsonError(res, 400, 'A valid email address is required.');
      }
      if (!message) {
        return jsonError(res, 400, 'Message is required.');
      }
      if (fname && !phone) {
        return jsonError(res, 400, 'Phone number is required.');
      }

      const siteTitle = siteSettingsService.getSiteTitle() || 'BlueField Group';
      const subject = `[${siteTitle}] Contact inquiry from ${name}`;
      const text = [
        `Source: ${source}`,
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        '',
        'Message:',
        message
      ]
        .filter(Boolean)
        .join('\n');

      const mailResult = await emailService.sendMail({
        to: resolveContactRecipients(),
        subject,
        text,
        replyTo: email
      });

      if (!mailResult.delivered) {
        const contact = resolveContactRecipients()[0];
        return jsonError(
          res,
          503,
          `Email is not configured on this server. Please email us directly at ${contact}.`
        );
      }

      res.json({
        success: true,
        message: 'Thank you. Your message has been sent successfully.'
      });
    } catch (error) {
      console.error('Contact form submission error:', error);
      jsonError(res, 500, 'Unable to send your message. Please try again later or email us directly.');
    }
  }

  public static async submitCareers(req: Request, res: Response): Promise<void> {
    let cvPath: string | undefined;

    try {
      const fname = trimField(req.body.fname);
      const lname = trimField(req.body.lname);
      const email = trimField(req.body.email);
      const name = [fname, lname].filter(Boolean).join(' ').trim();

      if (!fname || !lname) {
        return jsonError(res, 400, 'First and last name are required.');
      }
      if (!email || !isValidEmail(email)) {
        return jsonError(res, 400, 'A valid email address is required.');
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return jsonError(res, 400, 'Please upload your CV (PDF or TXT).');
      }

      const allowed = ['.pdf', '.txt'];
      const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
      if (!allowed.includes(ext)) {
        fs.unlinkSync(file.path);
        return jsonError(res, 400, 'CV must be a PDF or TXT file.');
      }

      cvPath = file.path;
      const siteTitle = siteSettingsService.getSiteTitle() || 'BlueField Group';
      const subject = `[${siteTitle}] Careers application from ${name}`;
      const text = [
        'Source: careers form',
        `Name: ${name}`,
        `Email: ${email}`,
        '',
        `CV attached: ${file.originalname}`
      ].join('\n');

      const mailResult = await emailService.sendMail({
        to: resolveCareersRecipients(),
        subject,
        text,
        replyTo: email,
        attachments: [
          {
            filename: file.originalname,
            path: file.path
          }
        ]
      });

      if (!mailResult.delivered) {
        const contact = resolveCareersRecipients()[0];
        return jsonError(
          res,
          503,
          `Email is not configured on this server. Please email us directly at ${contact}.`
        );
      }

      res.json({
        success: true,
        message: 'Thank you. Your application has been submitted successfully.'
      });
    } catch (error) {
      console.error('Careers form submission error:', error);
      jsonError(res, 500, 'Unable to submit your application. Please try again later or email us directly.');
    } finally {
      if (cvPath && fs.existsSync(cvPath)) {
        try {
          fs.unlinkSync(cvPath);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  }
}
