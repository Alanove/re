import { randomUUID } from 'node:crypto';
import type { DonationPledge, Submission, SubmissionType } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { submissionsRepository } from '../repositories/submissionsRepository.js';
import type { ContactFormInput, DonationFormInput } from '../schemas/publicSchemas.js';
import { mailService } from './mailService.js';
import { pagesService } from './pagesService.js';
import { settingsService } from './settingsService.js';

export interface SubmissionMeta {
  ip: string;
  userAgent: string;
}

type NewSubmission = Pick<Submission, 'type' | 'donation' | 'name' | 'email' | 'company' | 'phone' | 'topic' | 'productId' | 'productName' | 'message'>;

const amountFormat = new Intl.NumberFormat('en-US');

export function describePledge(pledge: DonationPledge): string {
  const frequency = pledge.frequency === 'monthly' ? 'every month' : 'one time';
  return `${pledge.currency} ${amountFormat.format(pledge.amount)} ${frequency}${pledge.cause ? `, for ${pledge.cause}` : ''}`;
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
    let productName = '';
    if (input.productId !== null) {
      const product = (await pagesService.getFlatList()).find((page) => page.id === input.productId && page.status === 'published');
      if (!product) {
        throw new BadRequestError('Please correct the highlighted fields.', { message: 'That product is no longer available. Please describe what you need.' });
      }
      productName = product.title;
    }
    await this.store(
      {
        type: 'contact',
        donation: null,
        name: input.name,
        email: input.email,
        company: input.company,
        phone: input.phone,
        topic: input.topic,
        productId: input.productId,
        productName,
        message: input.message
      },
      meta
    );
    return { stored: true };
  }

  public async pledge(input: DonationFormInput, meta: SubmissionMeta): Promise<{ stored: boolean }> {
    if (input.website) {
      return { stored: false };
    }
    const settings = await settingsService.get();
    if (!settings.donation.causes.includes(input.cause)) {
      throw new BadRequestError('Please correct the highlighted fields.', { cause: 'Choose one of the listed causes' });
    }
    const donation: DonationPledge = { amount: input.amount, currency: input.currency, frequency: input.frequency, cause: input.cause };
    await this.store(
      {
        type: 'donation',
        donation,
        name: input.name,
        email: input.email,
        company: '',
        phone: input.phone,
        topic: 'Donation pledge',
        productId: null,
        productName: '',
        message: input.message || `Pledge: ${describePledge(donation)}.`
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
      const subject =
        submission.type === 'donation' && submission.donation
          ? `[${settings.siteName}] Donation pledge from ${submission.name}: ${submission.donation.currency} ${amountFormat.format(submission.donation.amount)}`
          : `[${settings.siteName}] ${submission.topic} inquiry from ${submission.name}`;
      try {
        await mailService.send({
          to: settings.contactEmail,
          replyTo: submission.email,
          subject,
          text: [
            `Name: ${submission.name}`,
            `Email: ${submission.email}`,
            ...(submission.company ? [`Company: ${submission.company}`] : []),
            `Phone: ${submission.phone || '-'}`,
            ...(submission.donation ? [`Pledge: ${describePledge(submission.donation)}`] : [`Topic: ${submission.topic}`]),
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

  public async list(type: SubmissionType | null = null): Promise<Submission[]> {
    const submissions = await submissionsRepository.findAll();
    return type ? submissions.filter((submission) => submission.type === type) : submissions;
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
