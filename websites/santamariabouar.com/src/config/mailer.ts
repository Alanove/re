import dns from 'dns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function shouldForceIpv4(): boolean {
  if (process.env.SMTP_FORCE_IPV4 === 'false') return false;
  if (process.env.SMTP_FORCE_IPV4 === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

export function getSmtpSkipReason(): string | null {
  if (process.env.SMTP_DISABLED === 'true') {
    return 'SMTP_DISABLED=true';
  }
  if (!process.env.SMTP_HOST) return 'SMTP_HOST is unset';
  if (!process.env.SMTP_USER) return 'SMTP_USER is unset';
  if (!process.env.SMTP_PASS) return 'SMTP_PASS is unset';
  return null;
}

export function getMailTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (getSmtpSkipReason()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '10000', 10),
      greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || '10000', 10),
      ...(shouldForceIpv4()
        ? {
            lookup: (hostname: string, _options: unknown, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
              dns.lookup(hostname, { family: 4 }, callback);
            }
          }
        : {})
    });
  }

  return transporter;
}

export function getMailFrom(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@santamariabouar.com';
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

function formatRecipients(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

/**
 * Send an email. If SMTP is not configured, logs to console and resolves successfully.
 */
export async function sendMail(options: SendMailOptions): Promise<void> {
  const transport = getMailTransporter();
  const to = formatRecipients(options.to);

  if (!transport) {
    const reason = getSmtpSkipReason() || 'unknown';
    console.log(`[emailService] SMTP skipped (${reason}) — email logged instead of sent:`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body:\n${options.text}`);
    return;
  }

  await transport.sendMail({
    from: getMailFrom(),
    to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text.replace(/\n/g, '<br>'),
    attachments: options.attachments
  });
}
