import { randomUUID } from 'node:crypto';
import type { Submission, SubmissionType } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { submissionsRepository } from '../repositories/submissionsRepository.js';
import type { ContactFormInput, FeedbackFormInput } from '../schemas/publicSchemas.js';
import { mailService } from './mailService.js';
import { settingsService } from './settingsService.js';

export interface SubmissionMeta {
  ip: string;
  userAgent: string;
}

type NewSubmission = Pick<Submission, 'type' | 'name' | 'email' | 'company' | 'phone' | 'topic' | 'productId' | 'productName' | 'message'>;

export class ContactService {
  public async submit(input: ContactFormInput, meta: SubmissionMeta): Promise<{ stored: boolean }> {
    if (input.website) {
      return { stored: false };
    }
    const settings = await settingsService.get();
    if (!settings.inquiryTopics.includes(input.topic)) {
      throw new BadRequestError('Please correct the highlighted fields.', { topic: 'Choose one of the listed topics' });
    }
    await this.store(
      {
        type: 'contact',
        name: input.name,
        email: input.email,
        company: input.company,
        phone: input.phone,
        topic: input.topic,
        productId: null,
        productName: '',
        message: input.message
      },
      meta
    );
    return { stored: true };
  }

  public async submitFeedback(input: FeedbackFormInput, meta: SubmissionMeta): Promise<{ stored: boolean }> {
    if (input.website) {
      return { stored: false };
    }
    await this.store(
      {
        type: 'feedback',
        name: input.name,
        email: input.email,
        company: '',
        phone: '',
        topic: 'Feedback',
        productId: null,
        productName: '',
        message: input.message
      },
      meta
    );
    return { stored: true };
  }

  private async store(input: NewSubmission, meta: SubmissionMeta): Promise<void> {
    const settings = await settingsService.get();
    const submission: Submission = {
      id: randomUUID(),
      ...input,
      ip: meta.ip.slice(0, 64),
      userAgent: meta.userAgent.slice(0, 400),
      emailed: false,
      read: false,
      createdAt: new Date().toISOString()
    };
    await submissionsRepository.insert(submission);

    if (mailService.isConfigured()) {
      try {
        const kind = submission.type === 'feedback' ? 'feedback' : submission.topic;
        await mailService.send({
          to: settings.contactEmail,
          replyTo: submission.email,
          subject: `[${settings.siteName}] ${kind} from ${submission.name}`,
          text: [
            `Type: ${submission.type}`,
            `Name: ${submission.name}`,
            `Email: ${submission.email}`,
            `Company: ${submission.company || '-'}`,
            `Phone: ${submission.phone || '-'}`,
            `Topic: ${submission.topic}`,
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

  public async list(type: SubmissionType | null = null): Promise<Submission[]> {
    const all = await submissionsRepository.findAll();
    return type ? all.filter((item) => item.type === type) : all;
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
