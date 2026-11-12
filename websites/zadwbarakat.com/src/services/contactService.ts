import { randomUUID } from 'node:crypto';
import type { Submission, SubmissionType } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { submissionsRepository } from '../repositories/submissionsRepository.js';
import type { ContactFormInput } from '../schemas/publicSchemas.js';
import { mailService } from './mailService.js';
import { purchasesService } from './purchasesService.js';
import { settingsService } from './settingsService.js';

export interface SubmissionMeta {
  ip: string;
  userAgent: string;
}

export class ContactService {
  /** A form with `purchaseId` is an order request for an item from the purchases page. */
  public async submit(input: ContactFormInput, meta: SubmissionMeta): Promise<{ stored: boolean }> {
    if (input.website) {
      return { stored: false };
    }
    const settings = await settingsService.get();
    let type: SubmissionType = 'contact';
    let purchaseTitle = '';
    if (input.purchaseId !== null) {
      const item = await purchasesService.findPublishedById(input.purchaseId);
      if (!item) {
        throw new BadRequestError('يرجى تصحيح الحقول المشار إليها.', { message: 'هذا العنصر لم يعد متوفراً. يرجى وصف ما تريده.' });
      }
      type = 'purchase';
      purchaseTitle = item.title;
    } else if (!settings.inquiryTopics.includes(input.topic)) {
      throw new BadRequestError('يرجى تصحيح الحقول المشار إليها.', { topic: 'اختر أحد المواضيع المتاحة' });
    }

    const submission: Submission = {
      id: randomUUID(),
      type,
      name: input.name,
      email: input.email,
      phone: input.phone,
      topic: type === 'purchase' ? 'طلب شراء' : input.topic,
      purchaseId: input.purchaseId,
      purchaseTitle,
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
          subject: `[${settings.siteName}] ${submission.topic}: ${submission.name}`,
          text: [
            `Name: ${submission.name}`,
            `Email: ${submission.email}`,
            `Phone: ${submission.phone || '-'}`,
            `Topic: ${submission.topic}`,
            ...(purchaseTitle ? [`Item: ${purchaseTitle}`] : []),
            '',
            submission.message
          ].join('\n')
        });
        await submissionsRepository.patch(submission.id, { emailed: true });
      } catch (error) {
        console.error('Inquiry stored but email delivery failed', { id: submission.id, error });
      }
    }
    return { stored: true };
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
