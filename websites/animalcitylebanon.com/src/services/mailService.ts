import { env } from '../config/env.js';
import { createMailer, type Mailer } from '../vendor/email-sender/createMailer.js';

function buildMailer(): Mailer {
  if (!env.SMTP_HOST.trim()) {
    return createMailer(null);
  }
  const from = (env.MAIL_FROM || env.SMTP_USER).trim();
  if (!from) {
    return createMailer(null);
  }
  return createMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: Boolean(env.SMTP_SECURE),
    user: env.SMTP_USER,
    password: env.SMTP_PASS,
    from,
    defaultTo: env.MAIL_TO.trim() || undefined
  });
}

export const mailService = buildMailer();
