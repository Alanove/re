import { randomUUID } from 'node:crypto';
import type { Submission } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { submissionsRepository } from '../repositories/submissionsRepository.js';
import type { ContactFormInput } from '../schemas/publicSchemas.js';
import { mailService } from './mailService.js';
import { settingsService } from './settingsService.js';

export interface SubmissionMeta {
  ip: string;
  userAgent: string;
}

export class ContactService {
  public async submit(input: ContactFormInput, meta: SubmissionMeta): Promise<{ stored: boolean }> {
    if (input.website) {
      return { stored: false };
    }
    const settings = await settingsService.get();
    if (!settings.inquiryTopics.includes(input.topic)) {
      throw new BadRequestError('Please correct the highlighted fields.', { topic: 'Choose one of the listed topics' });
    }
    await this.store({ ...input, productId: null, productName: '' }, meta);
    return { stored: true };
  }

  private async store(input: Omit<ContactFormInput, 'website'> & { productId: number | null; productName: string }, meta: SubmissionMeta): Promise<void> {
    const settings = await settingsService.get();
    const submission: Submission = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      topic: input.topic,
      productId: input.productId,
      productName: input.productName,
      message: input.message,
      ip: meta.ip.slice(0, 64),
      userAgent: meta.userAgent.slice(0, 400),
      emailed: false,
      read: false,
      createdAt: new Date().toISOString()
    };
    await submissionsRepository.insert(submission);

    if (mailService.isConfigured()) {
      try {
        await mailService.send({
          to: settings.contactEmail,
          replyTo: submission.email,
          subject: `[${settings.siteName}] ${submission.topic} inquiry from ${submission.name}`,
          text: [
            `Name: ${submission.name}`,
            `Email: ${submission.email}`,
            `Company: ${submission.company || '-'}`,
            `Phone: ${submission.phone || '-'}`,
            `Topic: ${submission.topic}`,
            ...(submission.productName ? [`Product: ${submission.productName}`] : []),
            '',
            submission.message
          ].join('\n')
        });
        await submissionsRepository.patch(submission.id, { emailed: true });
      } catch (error) {
        console.error('Inquiry stored but email delivery failed', { id: submission.id, error });
      }
    }
  }

  public async list(): Promise<Submission[]> {
    return submissionsRepository.findAll();
  }

  public async get(id: string): Promise<Submission> {
    const submission = await submissionsRepository.findById(id);
    if (!submission) {
      throw new NotFoundError('Inquiry not found.');
    }
    if (!submission.read) {
      await submissionsRepository.patch(id, { read: true });
    }
    return { ...submission, read: true };
  }

  public async countUnread(): Promise<number> {
    const submissions = await submissionsRepository.findAll();
    return submissions.filter((submission) => !submission.read).length;
  }

  public async delete(id: string): Promise<void> {
    if (!(await submissionsRepository.remove(id))) {
      throw new NotFoundError('Inquiry not found.');
    }
  }
}

export const contactService = new ContactService();
