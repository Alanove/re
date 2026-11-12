import { randomUUID } from 'node:crypto';
import type { Subscriber } from '../domain/models.js';
import { NotFoundError } from '../errors/httpError.js';
import { toCsv } from '../lib/csv.js';
import { subscribersRepository } from '../repositories/subscribersRepository.js';

export class NewsletterService {
  /** Returns false when the address was already subscribed; callers show the same thank-you either way. */
  public async subscribe(email: string, ip: string): Promise<boolean> {
    return subscribersRepository.add({ id: randomUUID(), email: email.trim().toLowerCase(), ip: ip.slice(0, 64), createdAt: new Date().toISOString() });
  }

  public async list(): Promise<Subscriber[]> {
    return subscribersRepository.findAll();
  }

  public async remove(id: string): Promise<void> {
    if (!(await subscribersRepository.remove(id))) {
      throw new NotFoundError('Subscriber not found.');
    }
  }

  public async exportCsv(): Promise<string> {
    return toCsv(
      ['email', 'subscribed_at'],
      (await this.list()).map((subscriber) => [subscriber.email, subscriber.createdAt])
    );
  }
}

export const newsletterService = new NewsletterService();
