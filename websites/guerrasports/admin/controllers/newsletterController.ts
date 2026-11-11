import { Request, Response } from 'express';
import newsletterService from '../services/newsletterService';
import type { NewsletterSubscriber } from '../services/newsletterService';

function escapeCsvField(value: string): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export class NewsletterController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const subscribers = await newsletterService.getAll();
      const csrfToken = (res.locals as any).csrfToken || '';
      res.render('newsletter/newsletter', {
        subscribers,
        csrfToken,
        title: typeof (res.locals as any).t === 'function' ? (res.locals as any).t('newsletter.title') : 'Newsletter'
      });
    } catch (error) {
      console.error('Newsletter list error:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  static async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const subscribers: NewsletterSubscriber[] = await newsletterService.getAll();
      const header = 'id,email,created_at';
      const rows = subscribers.map((s) =>
        [s.id, escapeCsvField(s.email), escapeCsvField(s.created_at)].join(',')
      );
      const csv = [header, ...rows].join('\r\n');
      const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      console.error('Newsletter export CSV error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
