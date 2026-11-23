/* @local/email-sender 1.0.0 - generated from packages/email-sender, do not edit */
import nodemailer, { type Transporter } from 'nodemailer';
import { z } from 'zod';

const HEADER_INJECTION = /[\r\n]/;

const mailboxSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine((value) => !HEADER_INJECTION.test(value), { message: 'Address must not contain line breaks' })
  .pipe(z.email());

const subjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !HEADER_INJECTION.test(value), { message: 'Subject must not contain line breaks' });

const textSchema = z.string().trim().min(1).max(50_000);

export const mailerConfigSchema = z.object({
  host: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().optional().default(''),
  password: z.string().optional().default(''),
  from: mailboxSchema,
  defaultTo: mailboxSchema.optional()
});

export type MailerConfig = z.infer<typeof mailerConfigSchema>;

export const outgoingMailSchema = z.object({
  to: mailboxSchema.optional(),
  replyTo: mailboxSchema,
  subject: subjectSchema,
  text: textSchema
});

export type OutgoingMail = z.infer<typeof outgoingMailSchema>;

export class MailerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MailerError';
  }
}

export interface Mailer {
  isConfigured(): boolean;
  send(mail: OutgoingMail): Promise<void>;
}

/**
 * Builds an SMTP mailer from an explicit config object.
 * The package never reads process.env; the site maps its env into this shape.
 */
export function createMailer(rawConfig: MailerConfig | null | undefined): Mailer {
  if (!rawConfig || !String(rawConfig.host ?? '').trim()) {
    return {
      isConfigured(): boolean {
        return false;
      },
      send(): Promise<void> {
        return Promise.reject(new MailerError('Email is not configured.'));
      }
    };
  }

  let config: MailerConfig;
  try {
    config = mailerConfigSchema.parse(rawConfig);
  } catch (error) {
    throw new MailerError('Invalid mailer configuration.', { cause: error });
  }

  let transporter: Transporter | null = null;

  return {
    isConfigured(): boolean {
      return true;
    },
    async send(rawMail: OutgoingMail): Promise<void> {
      let mail: OutgoingMail;
      try {
        mail = outgoingMailSchema.parse(rawMail);
      } catch (error) {
        throw new MailerError('Invalid outgoing mail.', { cause: error });
      }

      const to = mail.to ?? config.defaultTo;
      if (!to) {
        throw new MailerError('No recipient address.');
      }

      transporter ??= nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        ...(config.user
          ? {
              auth: {
                user: config.user,
                pass: config.password
              }
            }
          : {}),
        tls: {
          rejectUnauthorized: true
        }
      });

      try {
        await transporter.sendMail({
          from: config.from,
          to,
          replyTo: mail.replyTo,
          subject: mail.subject,
          text: mail.text
        });
      } catch (error) {
        throw new MailerError('Failed to send email.', { cause: error });
      }
    }
  };
}
