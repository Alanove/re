import { Request, Response } from 'express';
import { securityService } from '../../src/services/securityService';
import emailService from '../../src/services/emailService';
import { integrationSettingsService, type SmtpSecureMode } from '../services/integrationSettingsService';

const BASE_URL = '/admin/integration-settings';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectWith(res: Response, kind: 'success' | 'error', message: string): void {
  res.redirect(`${BASE_URL}?${kind}=${encodeURIComponent(message)}`);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function checked(value: unknown): boolean {
  return value === 'on' || value === '1' || value === 'true' || value === true;
}

function parseSecureMode(value: unknown): SmtpSecureMode {
  return value === 'ssl' || value === 'starttls' ? value : 'auto';
}

export class IntegrationSettingsController {
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const [turnstile, smtp] = await Promise.all([
        integrationSettingsService.getTurnstileAdminView(),
        integrationSettingsService.getSmtpAdminView(),
      ]);
      res.render('integration-settings/integration-settings', {
        title: 'Security & Email',
        pageTitle: 'Security & Email',
        pageSubtitle: 'Cloudflare Turnstile and outgoing email (SMTP) settings',
        user: (req as any).user,
        url: req.originalUrl,
        csrfToken: (res.locals as any).csrfToken || '',
        turnstile,
        smtp,
        adminEmail: (req.session as any)?.user?.email || '',
        success: typeof req.query.success === 'string' ? req.query.success : undefined,
        error: typeof req.query.error === 'string' ? req.query.error : undefined,
      });
    } catch (error) {
      console.error('IntegrationSettingsController.index:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    securityService.csrfProtection(req, res, async (csrfErr: any) => {
      if (csrfErr) {
        return redirectWith(res, 'error', 'Security validation failed. Please try again.');
      }
      try {
        const body = req.body || {};

        const fromEmail = str(body.smtp_from_email);
        if (fromEmail && !EMAIL_RE.test(fromEmail)) {
          return redirectWith(res, 'error', 'Sender email address is not valid.');
        }
        const portRaw = parseInt(str(body.smtp_port), 10);
        if (str(body.smtp_port) && (Number.isNaN(portRaw) || portRaw < 1 || portRaw > 65535)) {
          return redirectWith(res, 'error', 'SMTP port must be between 1 and 65535.');
        }

        await integrationSettingsService.saveTurnstile({
          enabled: checked(body.turnstile_enabled),
          siteKey: str(body.turnstile_site_key),
          secretKey: str(body.turnstile_secret_key),
          clearSecret: checked(body.turnstile_clear_secret),
        });

        await integrationSettingsService.saveSmtp({
          host: str(body.smtp_host),
          port: Number.isNaN(portRaw) ? 587 : portRaw,
          secureMode: parseSecureMode(body.smtp_secure),
          user: str(body.smtp_user),
          password: typeof body.smtp_password === 'string' ? body.smtp_password : '',
          clearPassword: checked(body.smtp_clear_password),
          fromEmail,
          fromName: str(body.smtp_from_name),
          rejectUnauthorized: checked(body.smtp_reject_unauthorized),
        });

        const turnstile = await integrationSettingsService.getTurnstileAdminView();
        if (turnstile.enabled && !turnstile.active) {
          return redirectWith(
            res,
            'error',
            'Settings saved, but Turnstile stays disabled until both the site key and secret key are set.'
          );
        }
        redirectWith(res, 'success', 'Settings saved.');
      } catch (error) {
        console.error('IntegrationSettingsController.update:', error);
        redirectWith(res, 'error', 'Failed to save settings.');
      }
    });
  }

  public static async testEmail(req: Request, res: Response): Promise<void> {
    securityService.csrfProtection(req, res, async (csrfErr: any) => {
      if (csrfErr) {
        return redirectWith(res, 'error', 'Security validation failed. Please try again.');
      }
      try {
        const to = str(req.body?.test_email) || (req.session as any)?.user?.email || '';
        if (!EMAIL_RE.test(to)) {
          return redirectWith(res, 'error', 'Enter a valid recipient for the test email.');
        }

        const connection = await emailService.verifyConnection();
        if (!connection.ok) {
          return redirectWith(res, 'error', `SMTP connection failed: ${connection.error || 'unknown error'}`);
        }

        const sent = await emailService.sendEmail({
          to,
          subject: 'Test email - SMTP configuration',
          html: '<p>This is a test email from your website admin. If you received it, your SMTP settings are working.</p>',
          text: 'This is a test email from your website admin. If you received it, your SMTP settings are working.',
        });
        if (!sent) {
          return redirectWith(res, 'error', 'SMTP connected but sending failed. Check the server logs and sender address.');
        }
        redirectWith(res, 'success', `Test email sent to ${to}.`);
      } catch (error) {
        console.error('IntegrationSettingsController.testEmail:', error);
        redirectWith(res, 'error', 'Failed to send test email.');
      }
    });
  }
}
