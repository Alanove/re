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

function resolveContactRecipients(concern?: string): string[] {
  const settings: any = siteSettingsService.getAllSettings();
  const mapped = concern && settings.concernEmails ? String(settings.concernEmails[concern] || '').trim() : '';
  if (mapped) {
    return [mapped];
  }
  const email = siteSettingsService.getContactEmail().trim();
  if (email) {
    return [email];
  }
  return ['info@capitalpro.ca'];
}

function resolveCareersRecipients(): string[] {
  const careers = siteSettingsService.getCareersEmail().trim();
  const contact = siteSettingsService.getContactEmail().trim();
  const primary = careers || contact;
  if (primary) {
    return [primary];
  }
  return ['info@capitalpro.ca'];
}

function jsonError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

async function verifyRecaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = siteSettingsService.getRecaptchaSecretKey();
  if (!secret || !token) {
    return false;
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

export class FormsController {
  public static async submitContact(req: Request, res: Response): Promise<void> {
    try {
      if (!siteSettingsService.getRecaptchaSecretKey()) {
        return jsonError(res, 503, 'The contact form is not available right now. Please email or call us directly.');
      }
      const recaptchaToken = trimField(req.body.recaptchaToken) || trimField(req.body['g-recaptcha-response']);
      if (!(await verifyRecaptcha(recaptchaToken, req.ip))) {
        return jsonError(res, 400, 'Spam protection check failed. Please try again.');
      }

      const fname = trimField(req.body.fname);
      const lname = trimField(req.body.lname);
      const name = trimField(req.body.name) || [fname, lname].filter(Boolean).join(' ').trim();
      const email = trimField(req.body.email);
      const phone = trimField(req.body.phone);
      const company = trimField(req.body.company);
      const message = trimField(req.body.message);
      const source = trimField(req.body.source) || 'website';

      if (!name) {
        return jsonError(res, 400, 'Name is required.');
      }
      if (!email || !isValidEmail(email)) {
        return jsonError(res, 400, 'A valid email address is required.');
      }
      if (fname && !phone) {
        return jsonError(res, 400, 'Phone number is required.');
      }

      const siteTitle = siteSettingsService.getSiteTitle() || 'Capital Pro Group';
      const subjectField = trimField(req.body.subject);
      const concern = trimField(req.body.concern);
      const bestway = trimField(req.body.bestway);
      const besttime = trimField(req.body.besttime);
      const subject = `[${siteTitle}] ${concern || subjectField || 'Contact inquiry'} from ${name}`;
      const text = [
        `Source: ${source}`,
        `Name: ${name}`,
        company ? `Company: ${company}` : null,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        concern ? `Concern: ${concern}` : null,
        subjectField ? `Subject: ${subjectField}` : null,
        bestway ? `Best way to contact: ${bestway}` : null,
        besttime ? `Best time to contact: ${besttime}` : null,
        '',
        'Message:',
        message || '(none)'
      ]
        .filter(Boolean)
        .join('\n');

      const mailResult = await emailService.sendMail({
        to: resolveContactRecipients(concern),
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
      const siteTitle = siteSettingsService.getSiteTitle() || 'Capital Pro Group';
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
