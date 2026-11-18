import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface OutgoingMail {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

export class MailService {
  private transporter: Transporter | null = null;

  public isConfigured(): boolean {
    return env.SMTP_HOST.trim().length > 0;
  }

  public async send(mail: OutgoingMail): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }
    this.transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {})
    });
    await this.transporter.sendMail({
      from: env.MAIL_FROM || env.SMTP_USER,
      to: env.MAIL_TO || mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text
    });
  }
}

export const mailService = new MailService();
