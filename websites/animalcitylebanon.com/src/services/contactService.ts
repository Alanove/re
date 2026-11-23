import { env } from '../config/env.js';
import { ServiceUnavailableError } from '../errors/httpError.js';
import type { ContactFormInput } from '../schemas/contactSchemas.js';
import { MailerError } from '../vendor/email-sender/createMailer.js';
import { mailService } from './mailService.js';

export class ContactService {
  public async submit(input: ContactFormInput): Promise<{ sent: boolean }> {
    if (input.website) {
      return { sent: false };
    }

    if (!mailService.isConfigured() || !env.MAIL_TO.trim()) {
      throw new ServiceUnavailableError('Email is not configured yet. Please call us or try again later.');
    }

    try {
      await mailService.send({
        to: env.MAIL_TO.trim(),
        replyTo: input.email,
        subject: `[Animal City Lebanon] ${input.subject}`,
        text: [
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Subject: ${input.subject}`,
          '',
          input.message
        ].join('\n')
      });
    } catch (error) {
      if (error instanceof MailerError) {
        console.error('Contact email failed', { reason: error.message });
      } else {
        console.error('Contact email failed');
      }
      throw new ServiceUnavailableError('Your message could not be sent right now. Please try again later.', error);
    }

    return { sent: true };
  }
}

export const contactService = new ContactService();
