import { db } from '../../src/config/database';
import encryptionService from '../../src/services/encryptionService';

export interface NewsletterSubscriber {
  id: number;
  email: string;
  created_at: string;
}

interface NewsletterDbRow {
  id: number;
  content_encrypted: string;
  iv: string;
  created_at: string;
}

export class NewsletterService {
  private static instance: NewsletterService;

  static getInstance(): NewsletterService {
    if (!NewsletterService.instance) {
      NewsletterService.instance = new NewsletterService();
    }
    return NewsletterService.instance;
  }

  async getAll(): Promise<NewsletterSubscriber[]> {
    const [rows] = await db.query<NewsletterDbRow>(
      'SELECT id, content_encrypted, iv, created_at FROM newsletter_subscribers ORDER BY created_at DESC'
    );
    const result: NewsletterSubscriber[] = [];
    for (const row of rows) {
      try {
        const decrypted = encryptionService.decrypt(row.content_encrypted, row.iv);
        const email = decrypted?.email || '(decrypt failed)';
        result.push({
          id: row.id,
          email,
          created_at: row.created_at
        });
      } catch (e) {
        result.push({ id: row.id, email: '(error)', created_at: row.created_at });
      }
    }
    return result;
  }
}

export default NewsletterService.getInstance();
