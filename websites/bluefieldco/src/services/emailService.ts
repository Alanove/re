import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private configured = false;

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST?.trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined
      });
      this.configured = true;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[EmailService] SMTP_HOST is not set — form emails will be logged only. Configure SMTP_* env vars for production.'
      );
    }

    this.transporter = nodemailer.createTransport({ jsonTransport: true });
    this.configured = false;
  }

  public isSmtpConfigured(): boolean {
    return this.configured;
  }

  public getDefaultFrom(): string {
    return (
      process.env.SMTP_FROM?.trim() ||
      process.env.SMTP_USER?.trim() ||
      'noreply@bluefieldco.com'
    );
  }

  public async sendMail(
    options: SendEmailOptions
  ): Promise<{ messageId: string; delivered: boolean }> {
    if (!this.transporter) {
      throw new Error('Email transporter is not initialized');
    }

    if (!this.configured) {
      const toList = Array.isArray(options.to) ? options.to : [options.to];
      console.log('[EmailService] Form email (SMTP not configured):', {
        to: toList,
        subject: options.subject,
        text: options.text
      });
      return { messageId: 'logged', delivered: false };
    }

    const toList = Array.isArray(options.to) ? options.to : [options.to];
    const info = await this.transporter.sendMail({
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
