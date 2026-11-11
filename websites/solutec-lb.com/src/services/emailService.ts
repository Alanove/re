import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private transporterKey = '';

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Admin → Site Settings takes priority; SMTP_* environment variables are the fallback.
   */
  private getConfig(): SmtpConfig | null {
    const settings = SiteSettingsService.getInstance().getSmtpSettings();
    if (settings.host) {
      return settings;
    }

    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      return null;
    }
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    return {
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      user: process.env.SMTP_USER?.trim() || '',
      pass: process.env.SMTP_PASS?.trim() || '',
      from: process.env.SMTP_FROM?.trim() || ''
    };
  }

  private getTransporter(config: SmtpConfig): nodemailer.Transporter {
    const key = JSON.stringify([config.host, config.port, config.secure, config.user, config.pass]);
    if (!this.transporter || this.transporterKey !== key) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
      });
      this.transporterKey = key;
    }
    return this.transporter;
  }

  public isSmtpConfigured(): boolean {
    return this.getConfig() !== null;
  }

  public getDefaultFrom(): string {
    const config = this.getConfig();
    const userAsEmail = config?.user.includes('@') ? config.user : '';
    return config?.from || userAsEmail || SiteSettingsService.getInstance().getContactEmail().trim();
  }

  public async sendMail(
    options: SendEmailOptions
  ): Promise<{ messageId: string; delivered: boolean }> {
    const toList = Array.isArray(options.to) ? options.to : [options.to];
    const config = this.getConfig();

    if (!config) {
      console.log('[EmailService] Form email (SMTP not configured):', {
        to: toList,
        subject: options.subject,
        text: options.text
      });
      return { messageId: 'logged', delivered: false };
    }

    const info = await this.getTransporter(config).sendMail({
      from: this.getDefaultFrom(),
      to: toList.join(', '),
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
      replyTo: options.replyTo,
      attachments: options.attachments
    });

    return {
      messageId: info.messageId || 'sent',
      delivered: true
    };
  }
}
